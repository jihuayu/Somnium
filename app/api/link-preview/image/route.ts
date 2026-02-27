import { NextRequest, NextResponse } from 'next/server'
import { ONE_DAY_SECONDS, SEVEN_DAYS_SECONDS } from '@/lib/server/cache'
import { resolveLinkPreviewImageProxy } from '@/lib/server/linkPreviewImageProxy'

const FETCH_TIMEOUT_MS = 10_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const IMAGE_BROWSER_CACHE_SECONDS = SEVEN_DAYS_SECONDS
const IMAGE_STALE_SECONDS = ONE_DAY_SECONDS

function buildResponse({
  contentType,
  body,
  cacheTtlSeconds,
  contentLength
}: {
  contentType: string
  body: BodyInit
  cacheTtlSeconds: number
  contentLength?: number
}) {
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${IMAGE_BROWSER_CACHE_SECONDS}, s-maxage=${cacheTtlSeconds}, stale-while-revalidate=${IMAGE_STALE_SECONDS}`
  }

  if (typeof contentLength === 'number' && Number.isFinite(contentLength) && contentLength >= 0) {
    headers['Content-Length'] = String(contentLength)
  }

  return new NextResponse(body, {
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

async function readImageBodyWithLimit(
  body: ReadableStream<Uint8Array>,
  maxBytes: number
): Promise<Uint8Array | null> {
  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      total += value.byteLength
      if (total > maxBytes) return null
      chunks.push(value)
    }
  } finally {
    try { await reader.cancel() } catch {}
  }

  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim() || ''
  const resolved = resolveLinkPreviewImageProxy(rawUrl)
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid image URL or blocked by whitelist' }, { status: 400 })
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
      next: { revalidate: rule.cacheTtlSeconds },
      headers: requestHeaders
    })

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Upstream content is not an image' }, { status: 502 })
    }

    const contentLength = parseContentLength(response.headers.get('content-length'))
    if (typeof contentLength === 'number' && contentLength > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Upstream image is too large' }, { status: 413 })
    }

    if (!response.body) {
      return NextResponse.json({ error: 'Failed to read image response' }, { status: 502 })
    }

    if (typeof contentLength === 'number') {
      return buildResponse({
        contentType,
        body: response.body,
        contentLength,
        cacheTtlSeconds: rule.cacheTtlSeconds
      })
    }

    const imageBytes = await readImageBodyWithLimit(response.body, MAX_IMAGE_BYTES)
    if (!imageBytes) {
      return NextResponse.json({ error: 'Upstream image is too large' }, { status: 413 })
    }
    const imageBuffer = imageBytes.buffer.slice(
      imageBytes.byteOffset,
      imageBytes.byteOffset + imageBytes.byteLength
    ) as ArrayBuffer

    return buildResponse({
      contentType,
      body: new Blob([imageBuffer]),
      contentLength: imageBytes.byteLength,
      cacheTtlSeconds: rule.cacheTtlSeconds
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
