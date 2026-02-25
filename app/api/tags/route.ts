import { NextResponse } from 'next/server'
import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'

export const revalidate = 60

export async function GET() {
  try {
    const posts = await getAllPosts({ includePages: false })
    const tags = getAllTagsFromPosts(posts)
    return NextResponse.json(
      { tags },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
        }
      }
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        tags: {},
        error: error?.message || 'Failed to load tags'
      },
      { status: 500 }
    )
  }
}
