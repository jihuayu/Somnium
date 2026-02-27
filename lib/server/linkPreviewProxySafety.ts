import { resolveLinkPreviewImageProxy } from '@/lib/server/linkPreviewImageProxy'
import { getHostnameFromUrl, isPrivateHostname } from '@/lib/server/networkSafety'

export const SAFE_IMAGE_PROXY_RESPONSE_HEADERS = [
  'content-type',
  'etag',
  'last-modified',
  'vary'
] as const

export function buildSafeImageProxyResponseHeaders(
  upstreamHeaders: Headers,
  cacheControl: string
): Headers {
  const headers = new Headers()
  for (const key of SAFE_IMAGE_PROXY_RESPONSE_HEADERS) {
    const value = upstreamHeaders.get(key)
    if (value) headers.set(key, value)
  }
  headers.set('Cache-Control', cacheControl)
  headers.set('X-Content-Type-Options', 'nosniff')
  return headers
}

export function isSafeProxyRedirectTarget(url: string): boolean {
  const hostname = getHostnameFromUrl(url)
  if (isPrivateHostname(hostname)) return false
  return !!resolveLinkPreviewImageProxy(url)
}
