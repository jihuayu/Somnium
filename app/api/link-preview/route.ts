import { NextRequest, NextResponse } from 'next/server'
import { getLinkPreview, normalizePreviewUrl } from '@/lib/server/linkPreview'
import { ONE_DAY_SECONDS, SEVEN_DAYS_SECONDS } from '@/lib/server/cache'

const PREVIEW_BROWSER_CACHE_SECONDS = SEVEN_DAYS_SECONDS
const PREVIEW_EDGE_CACHE_SECONDS = ONE_DAY_SECONDS
const PREVIEW_STALE_SECONDS = ONE_DAY_SECONDS

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url')?.trim() || ''
  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing query param: url' }, { status: 400 })
  }

  if (!normalizePreviewUrl(rawUrl)) {
    return NextResponse.json({ error: 'Invalid or blocked URL' }, { status: 400 })
  }

  const data = await getLinkPreview(rawUrl)
  if (!data) {
    return NextResponse.json({ error: 'Invalid or blocked URL' }, { status: 400 })
  }

  return NextResponse.json(
    data,
    {
      headers: {
        'Cache-Control': `public, max-age=${PREVIEW_BROWSER_CACHE_SECONDS}, s-maxage=${PREVIEW_EDGE_CACHE_SECONDS}, stale-while-revalidate=${PREVIEW_STALE_SECONDS}`
      }
    }
  )
}
