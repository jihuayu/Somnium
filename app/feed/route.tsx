import { NextResponse } from 'next/server'
import { getAllPosts } from '@/lib/notion'
import { generateRss } from '@/lib/rss'

export async function GET(request: Request) {
  const siteOrigin = new URL(request.url).origin

  try {
    const posts = await getAllPosts({ includePages: false })
    const latestPosts = posts.slice(0, 10)
    const xmlFeed = await generateRss(latestPosts, siteOrigin)

    return new NextResponse(xmlFeed, {
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8'
      }
    })
  } catch (error) {
    console.error('[feed] Failed to generate feed:', error)
    const fallbackFeed = await generateRss([], siteOrigin)
    return new NextResponse(fallbackFeed, {
      status: 200,
      headers: {
        'Content-Type': 'application/atom+xml; charset=utf-8'
      }
    })
  }
}
