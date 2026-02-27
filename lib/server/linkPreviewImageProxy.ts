import { ONE_DAY_SECONDS } from '@/lib/server/cache'

interface LinkPreviewImageProxyRule {
  id: string
  match: (url: URL) => boolean
  referer?: string
  cacheTtlSeconds?: number
}

const IMAGE_PROXY_RULES: LinkPreviewImageProxyRule[] = [
  {
    id: 'douban',
    match: (url: URL) =>
      url.protocol === 'https:' &&
      (
        url.hostname.toLowerCase() === 'img1.doubanio.com' || 
        url.hostname.toLowerCase() === 'img2.doubanio.com' || 
        url.hostname.toLowerCase() === 'img3.doubanio.com'
    ) &&
      url.pathname.startsWith('/'),
    referer: 'https://book.douban.com/',
    cacheTtlSeconds: ONE_DAY_SECONDS
  }
]

export function normalizeHttpUrl(rawUrl: string): URL | null {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed
  } catch {
    return null
  }
}

export function resolveLinkPreviewImageProxy(rawUrl: string): {
  normalizedUrl: string
  rule: {
    id: string
    referer: string
    cacheTtlSeconds: number
  }
} | null {
  const parsed = normalizeHttpUrl(rawUrl)
  if (!parsed) return null

  for (const rule of IMAGE_PROXY_RULES) {
    if (rule.match(parsed)) {
      return {
        normalizedUrl: parsed.toString(),
        rule: {
          id: rule.id,
          referer: rule.referer || '',
          cacheTtlSeconds: rule.cacheTtlSeconds || ONE_DAY_SECONDS
        }
      }
    }
  }
  return null
}

export function isLinkPreviewImageWhitelisted(rawUrl: string): boolean {
  const parsed = normalizeHttpUrl(rawUrl)
  if (!parsed) return false
  return IMAGE_PROXY_RULES.some(rule => rule.match(parsed))
}

export function canUseLinkPreviewOgProxy(rawUrl: string): boolean {
  if (!rawUrl) return false
  try {
    const parsed = new URL(rawUrl, 'https://proxy.local')
    if (parsed.pathname !== '/api/link-preview/image') return false
    const sourceImageUrl = parsed.searchParams.get('url')?.trim() || ''
    return isLinkPreviewImageWhitelisted(sourceImageUrl)
  } catch {
    return false
  }
}

export function toLinkPreviewImageProxyUrl(rawImageUrl: string): string {
  const resolved = resolveLinkPreviewImageProxy(rawImageUrl)
  if (!resolved) return rawImageUrl
  return `/api/link-preview/image?url=${encodeURIComponent(resolved.normalizedUrl)}`
}
