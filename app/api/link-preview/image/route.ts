import { NextRequest, NextResponse } from 'next/server'
import net from 'node:net'
import { resolveLinkPreviewImageProxy } from '@/lib/server/linkPreviewImageProxy'

const FETCH_TIMEOUT_MS = 10_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

function getHostname(url: string): string {
  try { return new URL(url).hostname.toLowerCase() } catch { return '' }
}

function isPrivateHostname(hostname: string): boolean {
  if (!hostname) return true
  if (hostname === 'localhost') return true
  if (hostname.endsWith('.local')) return true

  const ipVersion = net.isIP(hostname)
  if (ipVersion === 4) {
    if (hostname.startsWith('10.')) return true
    if (hostname.startsWith('127.')) return true
    if (hostname.startsWith('192.168.')) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true
    if (hostname.startsWith('169.254.')) return true
  }
  if (ipVersion === 6) {
    const lower = hostname.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  }

  return false
}

function buildResponse({
  contentType,
  body,
  cacheTtlSeconds,
  contentLength
}: {
  contentType: string
  body: ReadableStream<Uint8Array>
  cacheTtlSeconds: number
  contentLength?: number
}) {
  const browserMaxAge = Math.min(60 * 60, cacheTtlSeconds)
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': `public, max-age=${browserMaxAge}, s-maxage=${cacheTtlSeconds}, stale-while-revalidate=86400`
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

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim() || ''
  const resolved = resolveLinkPreviewImageProxy(rawUrl)
  if (!resolved) {
    return NextResponse.json({ error: 'Invalid image URL' }, { status: 400 })
  }

  const { normalizedUrl, rule } = resolved

  const targetHostname = getHostname(normalizedUrl)
  if (isPrivateHostname(targetHostname)) {
    return NextResponse.json({ error: 'Blocked hostname' }, { status: 400 })
  }

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

    const finalHostname = getHostname(response.url || normalizedUrl)
    if (isPrivateHostname(finalHostname)) {
      return NextResponse.json({ error: 'Blocked redirected hostname' }, { status: 400 })
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

    return buildResponse({
      contentType,
      body: response.body,
      contentLength,
      cacheTtlSeconds: rule.cacheTtlSeconds
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
