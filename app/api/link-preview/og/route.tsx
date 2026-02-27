import { ONE_DAY_SECONDS, SEVEN_DAYS_SECONDS } from '@/lib/server/cache'
import { isLinkPreviewImageWhitelisted } from '@/lib/server/linkPreviewImageProxy'

export const runtime = 'edge'
const OG_IMAGE_BROWSER_CACHE_SECONDS = SEVEN_DAYS_SECONDS
const OG_IMAGE_EDGE_CACHE_SECONDS = ONE_DAY_SECONDS
const OG_IMAGE_STALE_SECONDS = ONE_DAY_SECONDS

const DEFAULT_CACHE_CONTROL = `public, max-age=${OG_IMAGE_BROWSER_CACHE_SECONDS}, s-maxage=${OG_IMAGE_EDGE_CACHE_SECONDS}, stale-while-revalidate=${OG_IMAGE_STALE_SECONDS}`

function toAbsoluteImageUrl(rawUrl: string, requestUrl: string): string {
  if (!rawUrl) return ''
  try {
    const requestBase = new URL(requestUrl)
    const parsed = new URL(rawUrl, requestBase)
    if (parsed.origin !== requestBase.origin) return ''
    if (parsed.pathname !== '/api/link-preview/image') return ''
    const sourceImageUrl = parsed.searchParams.get('url')?.trim() || ''
    if (!isLinkPreviewImageWhitelisted(sourceImageUrl)) return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawImageUrl = searchParams.get('image')?.trim() || ''
  const proxyTargetUrl = toAbsoluteImageUrl(rawImageUrl, req.url)
  if (!proxyTargetUrl) {
    return new Response('Missing image or blocked by whitelist', { status: 400 })
  }

  try {
    const upstream = await fetch(proxyTargetUrl, {
      redirect: 'follow',
      headers: {
        Accept: 'image/*,*/*;q=0.8'
      }
    })

    const headers = new Headers(upstream.headers)
    if (!headers.get('Cache-Control')) {
      headers.set('Cache-Control', DEFAULT_CACHE_CONTROL)
    }

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    })
  } catch (error) {
    console.error('[link-preview/og] proxy failed:', error)
    return new Response('Failed to proxy image', { status: 502 })
  }
}
