import type { APIRoute } from 'astro'
import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import { ONE_DAY_SECONDS, ONE_HOUR_SECONDS } from '@/lib/server/cache'

const TAGS_BROWSER_CACHE_SECONDS = ONE_HOUR_SECONDS
const TAGS_EDGE_CACHE_SECONDS = ONE_DAY_SECONDS
const TAGS_STALE_SECONDS = ONE_DAY_SECONDS

export const GET: APIRoute = async () => {
  try {
    const posts = await getAllPosts({ includePages: false })
    const tags = getAllTagsFromPosts(posts)
    return Response.json(
      { tags },
      {
        headers: {
          'Cache-Control': `public, max-age=${TAGS_BROWSER_CACHE_SECONDS}, s-maxage=${TAGS_EDGE_CACHE_SECONDS}, stale-while-revalidate=${TAGS_STALE_SECONDS}`
        }
      }
    )
  } catch (error: any) {
    return Response.json(
      {
        tags: {},
        error: error?.message || 'Failed to load tags'
      },
      { status: 500 }
    )
  }
}