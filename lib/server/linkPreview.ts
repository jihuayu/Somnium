import { unstable_cache } from 'next/cache'
import { toLinkPreviewImageProxyUrl } from '@/lib/server/linkPreviewImageProxy'
import type { LinkPreviewData, LinkPreviewMap } from '@/lib/link-preview/types'
import { resolveLinkPreviewByAdapter, type ParsedLinkPreviewMetadata } from '@/lib/server/linkPreviewAdapters'
import { getHostnameFromUrl, isPrivateHostname } from '@/lib/server/networkSafety'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { mapWithConcurrency } from '@/lib/utils/promisePool'

const LINK_PREVIEW_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS
const LINK_PREVIEW_FETCH_CONCURRENCY = 6
const LINK_PREVIEW_MAX_HTML_BYTES = 256 * 1024

const CHARSET_ALIASES: Record<string, string> = {
  utf8: 'utf-8',
  gb2312: 'gbk'
}

function decodeEntities(input = ''): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
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

export function parseCharsetFromContentType(contentType: string): string {
  const match = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)
  if (!match?.[1]) return ''
  const normalized = match[1].trim().toLowerCase()
  if (!normalized) return ''
  return CHARSET_ALIASES[normalized] || normalized
}

function createTextDecoderForContentType(contentType: string): TextDecoder {
  const charset = parseCharsetFromContentType(contentType)
  if (!charset) return new TextDecoder()
  try {
    return new TextDecoder(charset)
  } catch {
    return new TextDecoder()
  }
}

async function readTextHeadWithLimit(
  response: Response,
  maxBytes: number,
  decoder: TextDecoder
): Promise<string> {
  if (!response.body) return ''

  const reader = response.body.getReader()
  const chunks: string[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue

      const remaining = maxBytes - total
      if (remaining <= 0) break

      if (value.byteLength > remaining) {
        const slice = value.subarray(0, remaining)
        chunks.push(decoder.decode(slice, { stream: true }))
        total += slice.byteLength
        break
      }

      chunks.push(decoder.decode(value, { stream: true }))
      total += value.byteLength
    }
  } finally {
    try { await reader.cancel() } catch {}
  }

  chunks.push(decoder.decode())
  return chunks.join('')
}

function createFallback(url: string): LinkPreviewData {
  const hostname = getHostnameFromUrl(url)
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

    const resolvedUrl = response.url || normalizedUrl
    const resolvedHostname = getHostnameFromUrl(resolvedUrl)
    if (isPrivateHostname(resolvedHostname)) {
      return fallback
    }

    const decoder = createTextDecoderForContentType(contentType)
    const html = await readTextHeadWithLimit(response, LINK_PREVIEW_MAX_HTML_BYTES, decoder)
    if (!html) {
      return fallback
    }
    const metadata = parseMetadata(html, resolvedUrl)
    const hostname = resolvedHostname
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
    const finalHostname = `${adapted.hostname || hostname || getHostnameFromUrl(finalUrl)}`.trim() || hostname
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

  const records = await mapWithConcurrency(
    uniqueUrls,
    LINK_PREVIEW_FETCH_CONCURRENCY,
    async (url) => {
      const data = await getLinkPreview(url)
      return data ? [url, data] as const : null
    }
  )

  const map: LinkPreviewMap = {}
  for (const item of records) {
    if (!item) continue
    const [key, data] = item
    map[key] = data
  }
  return map
}
