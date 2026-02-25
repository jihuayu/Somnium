import { NextRequest, NextResponse } from 'next/server'
import net from 'node:net'
import { resolveLinkPreviewImageProxy } from '@/lib/server/linkPreviewImageProxy'

const FETCH_TIMEOUT_MS = 10_000
const MAX_CACHED_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_CACHE_ITEMS = 200

type CachedImage = {
  expiresAt: number
  contentType: string
  bytes: Uint8Array
}

const globalObj = globalThis as any
if (!globalObj.__NOBELIUM_LINK_PREVIEW_IMAGE_CACHE__) {
  globalObj.__NOBELIUM_LINK_PREVIEW_IMAGE_CACHE__ = new Map<string, CachedImage>()
}
const imageCache: Map<string, CachedImage> = globalObj.__NOBELIUM_LINK_PREVIEW_IMAGE_CACHE__

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
  bytes,
  cacheTtlSeconds
}: {
  contentType: string
  bytes: Uint8Array
  cacheTtlSeconds: number
}) {
  const browserMaxAge = Math.min(60 * 60, cacheTtlSeconds)
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(bytes.byteLength),
      'Cache-Control': `public, max-age=${browserMaxAge}, s-maxage=${cacheTtlSeconds}, stale-while-revalidate=86400`
    }
  })
}

function pruneCache(now: number) {
  if (imageCache.size <= MAX_CACHE_ITEMS) return

  for (const [key, value] of imageCache.entries()) {
    if (value.expiresAt <= now) {
      imageCache.delete(key)
    }
  }

  while (imageCache.size > MAX_CACHE_ITEMS) {
    const firstKey = imageCache.keys().next().value
    if (!firstKey) break
    imageCache.delete(firstKey)
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim() || ''
  const resolved = resolveLinkPreviewImageProxy(rawUrl)
  if (!resolved) {
    return NextResponse.json({ error: 'Image URL is not allowed for proxying' }, { status: 400 })
  }

  const { normalizedUrl, rule } = resolved
  const cacheKey = `${rule.id}:${normalizedUrl}`
  const now = Date.now()
  const cacheHit = imageCache.get(cacheKey)
  if (cacheHit && cacheHit.expiresAt > now) {
    return buildResponse({
      contentType: cacheHit.contentType,
      bytes: cacheHit.bytes,
      cacheTtlSeconds: rule.cacheTtlSeconds
    })
  }

  const targetHostname = getHostname(normalizedUrl)
  if (isPrivateHostname(targetHostname)) {
    return NextResponse.json({ error: 'Blocked hostname' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(normalizedUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Referer: rule.referer,
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; NobeliumImageProxy/1.0)'
      }
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

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength <= MAX_CACHED_IMAGE_BYTES) {
      imageCache.set(cacheKey, {
        expiresAt: now + rule.cacheTtlSeconds * 1000,
        contentType,
        bytes
      })
      pruneCache(now)
    }

    return buildResponse({ contentType, bytes, cacheTtlSeconds: rule.cacheTtlSeconds })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch image' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}
