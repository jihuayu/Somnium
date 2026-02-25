import { NextRequest, NextResponse } from 'next/server'
import { getLinkPreview, normalizePreviewUrl } from '@/lib/server/linkPreview'

const PREVIEW_BROWSER_CACHE_SECONDS = 10 * 60
const PREVIEW_EDGE_CACHE_SECONDS = 60 * 60 * 6

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
        'Cache-Control': `public, max-age=${PREVIEW_BROWSER_CACHE_SECONDS}, s-maxage=${PREVIEW_EDGE_CACHE_SECONDS}, stale-while-revalidate=86400`
      }
    }
  )
}
