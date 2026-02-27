import { ImageResponse } from '@vercel/og'
import { ONE_DAY_SECONDS, SEVEN_DAYS_SECONDS } from '@/lib/server/cache'

export const runtime = 'nodejs'
const TARGET_HEIGHT = 440
const FALLBACK_WIDTH = 520
const OG_IMAGE_BROWSER_CACHE_SECONDS = SEVEN_DAYS_SECONDS
const OG_IMAGE_EDGE_CACHE_SECONDS = ONE_DAY_SECONDS
const OG_IMAGE_STALE_SECONDS = ONE_DAY_SECONDS

function toAbsoluteImageUrl(rawUrl: string, requestUrl: string): string {
  if (!rawUrl) return ''
  try {
    const requestBase = new URL(requestUrl)
    const parsed = new URL(rawUrl, requestBase)
    if (parsed.origin !== requestBase.origin) return ''
    if (parsed.pathname !== '/api/link-preview/image') return ''
    return parsed.toString()
  } catch {
    return ''
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawImageUrl = searchParams.get('image')?.trim() || ''
  const sourceImageUrl = toAbsoluteImageUrl(rawImageUrl, req.url)
  if (!sourceImageUrl) {
    return new Response('Missing image', { status: 400 })
  }

  const result = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#f8fafc',
          boxSizing: 'border-box'
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sourceImageUrl}
          alt="Link preview image"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>
    ),
    {
      width: FALLBACK_WIDTH,
      height: TARGET_HEIGHT
    }
  )

  result.headers.set(
    'Cache-Control',
    `public, max-age=${OG_IMAGE_BROWSER_CACHE_SECONDS}, s-maxage=${OG_IMAGE_EDGE_CACHE_SECONDS}, stale-while-revalidate=${OG_IMAGE_STALE_SECONDS}`
  )

  return result
}
