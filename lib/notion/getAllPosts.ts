import { config as BLOG } from '@/lib/server/config'
import { notionClient } from '@/lib/server/notionData'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { unstable_cache } from 'next/cache'
import { queryAllDataSourceEntries, type NotionClient } from '@jihuayu/notion-react/data'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapNotionPageToPost, normalizeNotionUuid } from './postAdapter'

const POSTS_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS

interface NotionPostsDependencies {
  apiClient?: Pick<NotionClient, 'queryAllDataSourcePages'>
  dataSourceId?: string
  sortByDate?: boolean
}

async function fetchAllPosts(includePages: boolean, {
  apiClient = notionClient,
  dataSourceId: rawDataSourceId = process.env.NOTION_DATA_SOURCE_ID,
  sortByDate = BLOG.sortByDate
}: NotionPostsDependencies = {}): Promise<PostData[]> {
  const dataSourceId = normalizeNotionUuid(rawDataSourceId)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const data = await queryAllDataSourceEntries(apiClient as NotionClient, {
    dataSourceId,
    mapPage: mapNotionPageToPost,
    filterEntry: (post) => !!post?.id,
    sortEntries: sortByDate ? (left, right) => right.date - left.date : undefined
  })

  const posts = filterPublishedPosts({ posts: data, includePages })

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
