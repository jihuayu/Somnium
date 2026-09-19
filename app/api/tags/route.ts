import { NextResponse } from 'next/server'
import { getAtriumBlogClient } from '@/lib/server/atriumBlog'

export const dynamic = 'force-dynamic'

function toTagRecord(tags: Array<{ name: string, count: number }>): Record<string, number> {
  return Object.fromEntries(tags.map(tag => [tag.name, tag.count]))
}

export async function GET() {
  try {
    const tags = toTagRecord(await getAtriumBlogClient().getTags())
    return NextResponse.json(
      { tags },
      {
        headers: { 'Cache-Control': 'no-store' }
      }
    )
  } catch {
    return NextResponse.json(
      {
        error: 'Blog tags unavailable'
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
