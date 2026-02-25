import { NextRequest, NextResponse } from 'next/server'
import net from 'node:net'

const CACHE_TTL_MS = 1000 * 60 * 60 * 6
const CACHE_VERSION = 'og-only-v1'

const globalObj = globalThis as any
if (!globalObj.__NOBELIUM_LINK_PREVIEW_CACHE__) {
  globalObj.__NOBELIUM_LINK_PREVIEW_CACHE__ = new Map<string, { expiresAt: number; data: any }>()
}
const cache: Map<string, { expiresAt: number; data: any }> = globalObj.__NOBELIUM_LINK_PREVIEW_CACHE__

function decodeEntities(input = ''): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

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
  }
  if (ipVersion === 6 && (hostname === '::1' || hostname.startsWith('fe80:'))) return true
  return false
}

function pickMetaValue(entries: Map<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = entries.get(key)
    if (value && value.length) return value
  }
  return ''
}

function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const pattern = /([:@a-zA-Z0-9_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g
  for (const match of tag.matchAll(pattern)) {
    const key = match[1].toLowerCase()
    const value = decodeEntities((match[3] || match[4] || '').trim())
    attrs[key] = value
  }
  return attrs
}

function toAbsoluteUrl(baseUrl: string, maybeRelativeUrl: string): string {
  if (!maybeRelativeUrl) return ''
  try { return new URL(maybeRelativeUrl, baseUrl).toString() } catch { return '' }
}

function parseMetadata(html: string, sourceUrl: string) {
  const head = html.slice(0, 200_000)
  const metaValues = new Map<string, string>()
  let icon = ''

  for (const match of head.matchAll(/<meta\s+[^>]*>/gi)) {
    const attrs = parseAttributes(match[0])
    const key = (attrs.property || attrs.name || '').toLowerCase()
    const content = attrs.content || ''
    if (!key || !content) continue
    if (!metaValues.has(key)) metaValues.set(key, content)
  }

  for (const match of head.matchAll(/<link\s+[^>]*>/gi)) {
    const attrs = parseAttributes(match[0])
    const rel = (attrs.rel || '').toLowerCase()
    const href = attrs.href || ''
    if (!rel || !href) continue
    if (rel.includes('icon')) {
      icon = toAbsoluteUrl(sourceUrl, href)
      if (icon) break
    }
  }

  const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const titleFromTag = decodeEntities((titleMatch?.[1] || '').trim())
  const title = pickMetaValue(metaValues, ['og:title']) || titleFromTag
  const description = pickMetaValue(metaValues, ['og:description', 'twitter:description', 'description'])
  const imageRaw = pickMetaValue(metaValues, ['og:image'])
  const image = toAbsoluteUrl(sourceUrl, imageRaw)

  return { title, description, image, icon }
}

function createFallback(url: string) {
  const hostname = getHostname(url)
  return {
    url,
    hostname,
    title: hostname || url,
    description: '',
    image: '',
    icon: hostname ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32` : ''
  }
}

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim() || ''
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing query param: url' }, { status: 400 })
  }

  let targetUrl: URL
  try {
    targetUrl = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    return NextResponse.json({ error: 'Only http/https URLs are allowed' }, { status: 400 })
  }

  if (isPrivateHostname(targetUrl.hostname.toLowerCase())) {
    return NextResponse.json({ error: 'Blocked hostname' }, { status: 400 })
  }

  const target = targetUrl.toString()
  const cacheKey = `${CACHE_VERSION}:${target}`
  const cacheEntry = cache.get(cacheKey)
  if (cacheEntry && cacheEntry.expiresAt > Date.now()) {
    return NextResponse.json(cacheEntry.data)
  }

  const fallback = createFallback(target)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(target, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NobeliumLinkPreview/1.0)',
        Accept: 'text/html,application/xhtml+xml'
      }
    })

    if (!response.ok) {
      cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: fallback })
      return NextResponse.json(fallback)
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html')) {
      cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: fallback })
      return NextResponse.json(fallback)
    }

    const html = await response.text()
    const resolvedUrl = response.url || target
    const metadata = parseMetadata(html, resolvedUrl)
    const hostname = getHostname(resolvedUrl)

    const data = {
      url: resolvedUrl,
      hostname,
      title: metadata.title || fallback.title,
      description: metadata.description || '',
      image: metadata.image || '',
      icon: metadata.icon || fallback.icon
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data })
    return NextResponse.json(data)
  } catch {
    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: fallback })
    return NextResponse.json(fallback)
  } finally {
    clearTimeout(timeout)
  }
}
