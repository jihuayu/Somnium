import net from 'node:net'
import { unstable_cache } from 'next/cache'
import { toLinkPreviewImageProxyUrl } from '@/lib/server/linkPreviewImageProxy'
import type { LinkPreviewData, LinkPreviewMap } from '@/lib/link-preview/types'
import { resolveLinkPreviewByAdapter, type ParsedLinkPreviewMetadata } from '@/lib/server/linkPreviewAdapters'

const LINK_PREVIEW_CACHE_REVALIDATE_SECONDS = 60 * 60 * 6

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

function parseMetadata(html: string, sourceUrl: string): ParsedLinkPreviewMetadata {
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
  const titleTag = decodeEntities((titleMatch?.[1] || '').trim())
  const ogTitle = pickMetaValue(metaValues, ['og:title'])
  const description = pickMetaValue(metaValues, ['og:description', 'twitter:description', 'description'])
  const imageRaw = pickMetaValue(metaValues, ['og:image'])
  const image = toAbsoluteUrl(sourceUrl, imageRaw)

  return { ogTitle, titleTag, description, image, icon }
}

function createFallback(url: string): LinkPreviewData {
  const hostname = getHostname(url)
  const defaultIcon = hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    : ''
  return {
    url,
    hostname,
    title: hostname || url,
    description: '',
    image: '',
    icon: toLinkPreviewImageProxyUrl(defaultIcon)
  }
}

function normalizeRawPreviewUrl(rawUrl: string): string {
  const trimmed = `${rawUrl || ''}`.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed
  if (/^(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)) {
    return `https://${trimmed}`
  }
  return trimmed
}

export function normalizePreviewUrl(rawUrl: string): string | null {
  const trimmed = normalizeRawPreviewUrl(rawUrl)
  if (!trimmed) return null

  try {
    const parsed = new URL(trimmed)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    if (isPrivateHostname(parsed.hostname.toLowerCase())) return null
    return parsed.toString()
  } catch {
    return null
  }
}

async function fetchLinkPreview(normalizedUrl: string): Promise<LinkPreviewData> {
  const fallback = createFallback(normalizedUrl)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(normalizedUrl, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NobeliumLinkPreview/1.0)',
        Accept: 'text/html,application/xhtml+xml'
      }
    })

    if (!response.ok) {
      return fallback
    }

    const contentType = (response.headers.get('content-type') || '').toLowerCase()
    if (!contentType.includes('text/html')) {
      return fallback
    }

    const html = await response.text()
    const resolvedUrl = response.url || normalizedUrl
    const metadata = parseMetadata(html, resolvedUrl)
    const hostname = getHostname(resolvedUrl)
    const parsedUrl = new URL(resolvedUrl)

    const adapted = resolveLinkPreviewByAdapter({
      normalizedUrl,
      resolvedUrl,
      hostname,
      parsedUrl,
      metadata,
      fallback
    })

    const finalUrl = `${adapted.url || resolvedUrl}`.trim() || resolvedUrl
    const finalHostname = `${adapted.hostname || hostname || getHostname(finalUrl)}`.trim() || hostname
    const finalTitle = `${adapted.title || ''}`.trim() || fallback.title
    const finalDescription = `${adapted.description || ''}`.trim()
    const finalImage = `${adapted.image || ''}`.trim()
    const finalIcon = `${adapted.icon || fallback.icon}`.trim()

    const data: LinkPreviewData = {
      url: finalUrl,
      hostname: finalHostname,
      title: finalTitle,
      description: finalDescription,
      image: toLinkPreviewImageProxyUrl(finalImage),
      icon: toLinkPreviewImageProxyUrl(finalIcon)
    }

    return data
  } catch {
    return fallback
  } finally {
    clearTimeout(timeout)
  }
}

const getCachedLinkPreview = unstable_cache(
  async (normalizedUrl: string): Promise<LinkPreviewData> => fetchLinkPreview(normalizedUrl),
  ['link-preview-metadata-v5'],
  {
    revalidate: LINK_PREVIEW_CACHE_REVALIDATE_SECONDS,
    tags: ['link-preview-metadata']
  }
)

export async function getLinkPreview(rawUrl: string): Promise<LinkPreviewData | null> {
  const normalizedUrl = normalizePreviewUrl(rawUrl)
  if (!normalizedUrl) return null
  return getCachedLinkPreview(normalizedUrl)
}

export async function getLinkPreviewMap(urls: string[]): Promise<LinkPreviewMap> {
  const uniqueUrls = Array.from(new Set(
    urls
      .map(url => normalizePreviewUrl(url))
      .filter((url): url is string => !!url)
  ))
  if (!uniqueUrls.length) return {}

  const records = await Promise.all(
    uniqueUrls.map(async (url) => {
      const data = await getLinkPreview(url)
      return data ? [url, data] as const : null
    })
  )

  const map: LinkPreviewMap = {}
  for (const item of records) {
    if (!item) continue
    const [key, data] = item
    map[key] = data
  }
  return map
}
