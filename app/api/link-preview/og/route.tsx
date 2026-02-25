import { ImageResponse } from '@vercel/og'
import { imageSize } from 'image-size'

export const runtime = 'nodejs'
const TARGET_HEIGHT = 440
const MIN_WIDTH = 180
const MAX_WIDTH = 900
const FALLBACK_WIDTH = 520

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

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

  let outputWidth = FALLBACK_WIDTH
  try {
    const response = await fetch(sourceImageUrl, {
      headers: {
        Accept: 'image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (compatible; NobeliumOgImage/1.0)'
      },
      redirect: 'follow'
    })
    if (response.ok) {
      const bytes = Buffer.from(await response.arrayBuffer())
      const dimensions = imageSize(bytes)
      if (dimensions.width && dimensions.height && dimensions.height > 0) {
        outputWidth = clamp(
          Math.round((TARGET_HEIGHT * dimensions.width) / dimensions.height),
          MIN_WIDTH,
          MAX_WIDTH
        )
      }
    }
  } catch {
    outputWidth = FALLBACK_WIDTH
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
      width: outputWidth,
      height: TARGET_HEIGHT
    }
  )

  result.headers.set(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
  )

  return result
}
