import type { LinkPreviewData } from '@/lib/link-preview/types'
import { getHostnameFromUrl } from '@/lib/server/url'
import { toLinkPreviewImageProxyUrl } from '@/lib/server/linkPreviewImageProxy'

const CHARSET_ALIASES: Record<string, string> = {
  utf8: 'utf-8',
  gb2312: 'gbk'
}

interface OgProxyMediaField {
  url?: string | null
  proxy?: string | null
}

interface OgProxyPayload {
  status?: string | null
  data?: {
    title?: string | null
    description?: string | null
    url?: string | null
    image?: OgProxyMediaField | null
    logo?: OgProxyMediaField | null
  } | null
}

export function decodeEntities(input = ''): string {
  return input
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
}

export function normalizeConfiguredUrl(rawUrl: string): string {
  const trimmed = `${rawUrl || ''}`.trim()
  if (!trimmed) return ''

  try {
    const parsed = new URL(trimmed)
    parsed.hash = ''
    return parsed.toString().replace(/\/+$/g, '')
  } catch {
    return ''
  }
}

export function buildOgProxyApiUrl(baseUrl: string, normalizedUrl: string): string | null {
  const normalizedBaseUrl = normalizeConfiguredUrl(baseUrl)
  if (!normalizedBaseUrl || !normalizedUrl) return null

  try {
    const apiUrl = new URL(normalizedBaseUrl)
    const pathname = apiUrl.pathname.replace(/\/+$/g, '')
    apiUrl.pathname = pathname.endsWith('/api') ? pathname : `${pathname || ''}/api`
    apiUrl.search = ''
    apiUrl.searchParams.set('url', normalizedUrl)
    return apiUrl.toString()
  } catch {
    return null
  }
}

function getProxyMediaUrl(field: OgProxyMediaField | null | undefined): string {
  const proxyUrl = decodeEntities(`${field?.proxy || ''}`.trim())
  if (proxyUrl) return proxyUrl
  return decodeEntities(`${field?.url || ''}`.trim())
}

export function mapOgProxyPayloadToPreview(
  normalizedUrl: string,
  fallback: LinkPreviewData,
  payload: unknown
): LinkPreviewData | null {
  const parsed = payload as OgProxyPayload | null | undefined
  if (!parsed || parsed.status !== 'success' || !parsed.data) return null

  const resolvedUrl = `${parsed.data.url || normalizedUrl}`.trim() || normalizedUrl
  const hostname = getHostnameFromUrl(resolvedUrl) || fallback.hostname
  const title = `${parsed.data.title || ''}`.trim() || fallback.title
  const description = `${parsed.data.description || ''}`.trim()
  const image = getProxyMediaUrl(parsed.data.image)
  const icon = getProxyMediaUrl(parsed.data.logo) || fallback.icon

  return {
    url: resolvedUrl,
    hostname,
    title,
    description,
    image: toLinkPreviewImageProxyUrl(image),
    icon: toLinkPreviewImageProxyUrl(icon)
  }
}

export function parseCharsetFromContentType(contentType: string): string {
  const match = contentType.match(/charset\s*=\s*["']?([^;"'\s]+)/i)
  if (!match?.[1]) return ''
  const normalized = match[1].trim().toLowerCase()
  if (!normalized) return ''
  return CHARSET_ALIASES[normalized] || normalized
}