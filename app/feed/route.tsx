import { NextResponse } from 'next/server'
import { getFeedPosts } from '@/lib/notion/getFeedPosts'
import { generateRss } from '@/lib/rss'
import { config } from '@/lib/server/config'
import { ONE_HOUR_SECONDS } from '@/lib/server/cache'

const FEED_ITEM_LIMIT = 20
const FEED_BROWSER_CACHE_SECONDS = ONE_HOUR_SECONDS * 12
const FEED_EDGE_CACHE_SECONDS = 60 * 60 * 24 * 7
const FEED_STALE_SECONDS = 60 * 60 * 24 * 30

export const revalidate = 43200
export const dynamic = 'force-static'

function buildFeedHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/rss+xml; charset=utf-8',
    'Cache-Control': `public, max-age=${FEED_BROWSER_CACHE_SECONDS}, s-maxage=${FEED_EDGE_CACHE_SECONDS}, stale-while-revalidate=${FEED_STALE_SECONDS}`
  }
}

export async function GET() {
  const siteOrigin = config.link

  try {
    const posts = await getFeedPosts()
    const latestPosts = posts.slice(0, FEED_ITEM_LIMIT)
    const xmlFeed = await generateRss(latestPosts, siteOrigin)

    return new NextResponse(xmlFeed, {
      headers: buildFeedHeaders()
    })
  } catch (error) {
    console.error('[feed] Failed to generate feed:', error)
    const fallbackFeed = await generateRss([], siteOrigin)
    return new NextResponse(fallbackFeed, {
      status: 200,
      headers: buildFeedHeaders()
    })
  }
}
