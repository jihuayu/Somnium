import { NextResponse } from 'next/server'
import { getAllPosts } from '@/lib/notion'
import { generateRss } from '@/lib/rss'

export async function GET() {
  const posts = await getAllPosts({ includePages: false })
  const latestPosts = posts.slice(0, 10)
  const xmlFeed = await generateRss(latestPosts)

  return new NextResponse(xmlFeed, {
    headers: {
      'Content-Type': 'text/xml'
    }
  })
}
