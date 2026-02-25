interface LinkPreviewImageProxyRule {
  id: string
  match: (url: URL) => boolean
  referer: string
  cacheTtlSeconds: number
}

const IMAGE_PROXY_RULES: LinkPreviewImageProxyRule[] = [
  {
    id: 'douban-img3',
    match: (url: URL) =>
      url.protocol === 'https:' &&
      url.hostname.toLowerCase() === 'img3.doubanio.com' &&
      url.pathname.startsWith('/'),
    referer: 'https://book.douban.com/',
    cacheTtlSeconds: 60 * 60 * 24
  }
]

function normalizeHttpUrl(rawUrl: string): URL | null {
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
  rule: LinkPreviewImageProxyRule
} | null {
  const parsed = normalizeHttpUrl(rawUrl)
  if (!parsed) return null

  for (const rule of IMAGE_PROXY_RULES) {
    if (rule.match(parsed)) {
      return {
        normalizedUrl: parsed.toString(),
        rule
      }
    }
  }

  return null
}

export function toLinkPreviewImageProxyUrl(rawImageUrl: string): string {
  const resolved = resolveLinkPreviewImageProxy(rawImageUrl)
  if (!resolved) return rawImageUrl
  return `/api/link-preview/image?url=${encodeURIComponent(resolved.normalizedUrl)}`
}
