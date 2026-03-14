import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { unstable_cache } from 'next/cache'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapPageToPost, normalizeNotionUuid } from './postMapper'

const POSTS_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS

interface NotionPostsDependencies {
  apiClient?: Pick<typeof api, 'queryAllDataSourcePages'>
  dataSourceId?: string
  sortByDate?: boolean
}

async function fetchAllPosts(includePages: boolean, {
  apiClient = api,
  dataSourceId: rawDataSourceId = process.env.NOTION_DATA_SOURCE_ID,
  sortByDate = BLOG.sortByDate
}: NotionPostsDependencies = {}): Promise<PostData[]> {
  const dataSourceId = normalizeNotionUuid(rawDataSourceId)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const pages = await apiClient.queryAllDataSourcePages(dataSourceId)
  const data = pages.map(page => mapPageToPost(page)).filter(post => post?.id)

  const posts = filterPublishedPosts({ posts: data, includePages })

  if (sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }

  return posts
}

const getCachedPostsOnly = unstable_cache(
  async () => fetchAllPosts(false),
  ['notion-posts-only'],
  { revalidate: POSTS_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts', 'notion-feed-posts'] }
)

const getCachedPostsAndPages = unstable_cache(
  async () => fetchAllPosts(true),
  ['notion-posts-and-pages'],
  { revalidate: POSTS_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts', 'notion-feed-posts'] }
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

export async function getAllPostsWithDependencies(
  { includePages = false }: { includePages: boolean },
  dependencies: NotionPostsDependencies
): Promise<PostData[]> {
  return fetchAllPosts(includePages, dependencies)
}
