import { FIVE_MINUTES_SECONDS } from '@/lib/server/cache'
import { getAtriumBlogClient, type AtriumBlogClient } from '@/lib/server/atriumBlog'
import { unstable_cache } from 'next/cache'
import type { PostData } from './filterPublishedPosts'

const POSTS_CACHE_REVALIDATE_SECONDS = FIVE_MINUTES_SECONDS

export interface AtriumPostsDependencies {
  client?: Pick<AtriumBlogClient, 'listAllPosts'>
}

async function fetchAllPosts(includePages: boolean, {
  client = getAtriumBlogClient()
}: AtriumPostsDependencies = {}): Promise<PostData[]> {
  return client.listAllPosts({ kind: includePages ? 'all' : 'post' })
}

const getCachedPostsOnly = unstable_cache(
  async () => fetchAllPosts(false),
  ['atrium-blog-posts-only'],
  { revalidate: POSTS_CACHE_REVALIDATE_SECONDS, tags: ['atrium-blog-posts', 'atrium-blog-feed'] }
)

const getCachedPostsAndPages = unstable_cache(
  async () => fetchAllPosts(true),
  ['atrium-blog-posts-and-pages'],
  { revalidate: POSTS_CACHE_REVALIDATE_SECONDS, tags: ['atrium-blog-posts', 'atrium-blog-feed'] }
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
  dependencies: AtriumPostsDependencies
): Promise<PostData[]> {
  return fetchAllPosts(includePages, dependencies)
}
