import { NextRequest, NextResponse } from 'next/server'
import { searchPosts } from '@/lib/notion/searchPosts'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export const dynamic = 'force-dynamic'

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT
  const value = Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(Math.floor(value), MAX_LIMIT))
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() || ''
  const limit = parseLimit(req.nextUrl.searchParams.get('limit'))

  if (!query) {
    return NextResponse.json({ posts: [] })
  }

  try {
    const posts = await searchPosts({ query, includePages: false, limit })
    return NextResponse.json({ posts })
  } catch (error: any) {
    return NextResponse.json(
      {
        posts: [],
        error: error?.message || 'Notion search failed'
      },
      { status: 500 }
    )
  }
}
