import { NextRequest, NextResponse } from 'next/server'
import { getLinkPreview, normalizePreviewUrl } from '@/lib/server/linkPreview'

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

  return NextResponse.json(data)
}
