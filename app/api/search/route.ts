import { NextRequest, NextResponse } from 'next/server'
import { searchPosts } from '@/lib/notion/searchPosts'
import { MIN_SEARCH_QUERY_LENGTH } from '@/lib/search/constants'
import { decodePossiblyEncoded } from '@/lib/url/decodePossiblyEncoded'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50
export const dynamic = 'force-dynamic'

function parseLimit(raw: string | null): number {
  if (!raw) return DEFAULT_LIMIT
  const value = Number(raw)
  if (!Number.isFinite(value)) return DEFAULT_LIMIT
  return Math.max(1, Math.min(Math.floor(value), MAX_LIMIT))
}

function parseTag(raw: string | null): string {
  if (!raw) return ''
  const trimmed = raw.trim()
  if (!trimmed) return ''
  return decodePossiblyEncoded(trimmed).trim()
}

function hasMinQueryLength(value: string): boolean {
  return Array.from(value).length >= MIN_SEARCH_QUERY_LENGTH
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.trim() || ''
  const tag = parseTag(req.nextUrl.searchParams.get('tag'))
  const limit = parseLimit(req.nextUrl.searchParams.get('limit'))

  if (!query || !hasMinQueryLength(query)) {
    return NextResponse.json(
      { posts: [] },
      {
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  }

  try {
    const posts = await searchPosts({ query, tag, includePages: false, limit, signal: req.signal })
    return NextResponse.json(
      { posts },
      {
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      return new NextResponse(null, { status: 204 })
    }
    return NextResponse.json(
      {
        error: 'Blog search unavailable'
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
