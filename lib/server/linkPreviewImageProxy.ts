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
    cacheTtlSeconds: 60 * 60 * 24
  }
]

const DEFAULT_PROXY_RULE = {
  id: 'default',
  referer: '',
  cacheTtlSeconds: 60 * 60 * 24
}

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
          cacheTtlSeconds: rule.cacheTtlSeconds || DEFAULT_PROXY_RULE.cacheTtlSeconds
        }
      }
    }
  }

  return {
    normalizedUrl: parsed.toString(),
    rule: DEFAULT_PROXY_RULE
  }
}

export function toLinkPreviewImageProxyUrl(rawImageUrl: string): string {
  const resolved = resolveLinkPreviewImageProxy(rawImageUrl)
  if (!resolved) return rawImageUrl
  return `/api/link-preview/image?url=${encodeURIComponent(resolved.normalizedUrl)}`
}
