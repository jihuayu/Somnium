import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import { unstable_cache } from 'next/cache'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapPageToPost, normalizeNotionUuid } from './postMapper'

const FEED_POSTS_CACHE_REVALIDATE_SECONDS = 60 * 60 * 24

async function fetchFeedPosts(): Promise<PostData[]> {
  const dataSourceId = normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const pages = await api.queryAllDataSourcePages(dataSourceId)
  const data = pages.map(mapPageToPost).filter(post => post?.id)
  const posts = filterPublishedPosts({ posts: data, includePages: false })

  if (BLOG.sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }

  return posts
}

const getCachedFeedPosts = unstable_cache(
  async () => fetchFeedPosts(),
  ['notion-feed-posts-v1'],
  { revalidate: FEED_POSTS_CACHE_REVALIDATE_SECONDS, tags: ['notion-feed-posts'] }
)

export async function getFeedPosts(): Promise<PostData[]> {
  const posts = await getCachedFeedPosts()
  return posts.slice()
}
