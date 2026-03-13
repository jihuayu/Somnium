import type { APIRoute } from 'astro'
import { ONE_DAY_SECONDS, SEVEN_DAYS_SECONDS } from '@/lib/server/cache'
import { resolveLinkPreviewImageProxy } from '@/lib/server/linkPreviewImageProxy'

const FETCH_TIMEOUT_MS = 10_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_BROWSER_CACHE_SECONDS = SEVEN_DAYS_SECONDS
const IMAGE_STALE_SECONDS = ONE_DAY_SECONDS

function buildResponse({
  contentType,
  body,
  cacheTtlSeconds
}: {
  contentType: string
  body: BodyInit
  cacheTtlSeconds: number
}) {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${IMAGE_BROWSER_CACHE_SECONDS}, s-maxage=${cacheTtlSeconds}, stale-while-revalidate=${IMAGE_STALE_SECONDS}`
  }

  return new Response(body, {
    status: 200,
    headers
  })
}

function parseContentLength(rawValue: string | null): number | undefined {
  if (!rawValue) return undefined
  const value = Number(rawValue)
  if (!Number.isFinite(value) || value < 0) return undefined
  return Math.floor(value)
}

function createByteLimitedStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  onExceeded: () => void
): ReadableStream<Uint8Array> {
  let total = 0
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, streamController) {
      total += chunk.byteLength
      if (total > maxBytes) {
        onExceeded()
        streamController.error(new Error('Upstream image is too large'))
        return
      }
      streamController.enqueue(chunk)
    }
  })
  return body.pipeThrough(limiter)
}

export const GET: APIRoute = async ({ request }) => {
  const rawUrl = new URL(request.url).searchParams.get('url')?.trim() || ''
  const resolved = resolveLinkPreviewImageProxy(rawUrl)
  if (!resolved) {
    return Response.json({ error: 'Invalid image URL or blocked by whitelist' }, { status: 400 })
  }

  const { normalizedUrl, rule } = resolved
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const requestHeaders: Record<string, string> = {
      Accept: 'image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (compatible; NobeliumImageProxy/1.0)'
    }
    if (rule.referer) {
      requestHeaders.Referer = rule.referer
    }

    const response = await fetch(normalizedUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: requestHeaders
    })

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch image' }, { status: 502 })
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('image/')) {
      return Response.json({ error: 'Upstream content is not an image' }, { status: 502 })
    }

    const contentLength = parseContentLength(response.headers.get('content-length'))
    if (typeof contentLength === 'number' && contentLength > MAX_IMAGE_BYTES) {
      return Response.json({ error: 'Upstream image is too large' }, { status: 413 })
    }

    if (!response.body) {
      return Response.json({ error: 'Failed to read image response' }, { status: 502 })
    }

    const limitedBody = createByteLimitedStream(
      response.body,
      MAX_IMAGE_BYTES,
      () => controller.abort()
    )

    return buildResponse({
      contentType,
      body: limitedBody,
      cacheTtlSeconds: rule.cacheTtlSeconds
    })
  } catch {
    return Response.json({ error: 'Failed to fetch image' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}