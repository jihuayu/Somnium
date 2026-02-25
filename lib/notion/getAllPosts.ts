import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import { unstable_cache } from 'next/cache'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapPageToPost, normalizeNotionUuid } from './postMapper'

const POSTS_CACHE_REVALIDATE_SECONDS = 30

async function fetchAllPosts(includePages: boolean): Promise<PostData[]> {
  const dataSourceId = normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const pages = await api.queryAllDataSourcePages(dataSourceId)
  const data = pages.map(mapPageToPost).filter(post => post?.id)

  const posts = filterPublishedPosts({ posts: data, includePages })

  if (BLOG.sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }

  return posts
}

const getCachedPostsOnly = unstable_cache(
  async () => fetchAllPosts(false),
  ['notion-posts-only'],
  { revalidate: POSTS_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts'] }
)

const getCachedPostsAndPages = unstable_cache(
  async () => fetchAllPosts(true),
  ['notion-posts-and-pages'],
  { revalidate: POSTS_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts'] }
)

/**
 * @param includePages - false: posts only / true: include pages
 */
export async function getAllPosts({ includePages = false }: { includePages: boolean }): Promise<PostData[]> {
  const posts = includePages
    ? await getCachedPostsAndPages()
    : await getCachedPostsOnly()
  return posts.slice()
}
