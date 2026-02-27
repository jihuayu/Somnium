import { ONE_DAY_SECONDS, SEVEN_DAYS_SECONDS } from '@/lib/server/cache'
import {
  canUseLinkPreviewOgProxy,
  resolveLinkPreviewImageProxy
} from '@/lib/server/linkPreviewImageProxy'

export const runtime = 'edge'
const OG_IMAGE_BROWSER_CACHE_SECONDS = SEVEN_DAYS_SECONDS
const OG_IMAGE_EDGE_CACHE_SECONDS = ONE_DAY_SECONDS
const OG_IMAGE_STALE_SECONDS = ONE_DAY_SECONDS

const DEFAULT_CACHE_CONTROL = `public, max-age=${OG_IMAGE_BROWSER_CACHE_SECONDS}, s-maxage=${OG_IMAGE_EDGE_CACHE_SECONDS}, stale-while-revalidate=${OG_IMAGE_STALE_SECONDS}`

function parseSourceImageUrl(rawUrl: string, requestUrl: string): string {
  if (!rawUrl) return ''
  try {
    const requestBase = new URL(requestUrl)
    const parsed = new URL(rawUrl, requestBase)
    if (parsed.origin !== requestBase.origin) return ''
    if (!canUseLinkPreviewOgProxy(parsed.toString())) return ''
    return parsed.searchParams.get('url')?.trim() || ''
  } catch {
    return ''
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawImageUrl = searchParams.get('image')?.trim() || ''
  const sourceImageUrl = parseSourceImageUrl(rawImageUrl, req.url)
  const resolved = resolveLinkPreviewImageProxy(sourceImageUrl)
  if (!sourceImageUrl || !resolved) {
    return new Response('Missing image or blocked by whitelist', { status: 400 })
  }

  try {
    const requestHeaders: Record<string, string> = {
      Accept: 'image/*,*/*;q=0.8'
    }
    if (resolved.rule.referer) {
      requestHeaders.Referer = resolved.rule.referer
    }

    const upstream = await fetch(resolved.normalizedUrl, {
      redirect: 'follow',
      headers: requestHeaders
    })

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase()
    if (!upstream.ok || !contentType.startsWith('image/')) {
      return new Response('Failed to proxy image', { status: 502 })
    }

    const headers = new Headers(upstream.headers)
    headers.set('Cache-Control', DEFAULT_CACHE_CONTROL)

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
