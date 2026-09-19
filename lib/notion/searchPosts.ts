import { getAtriumBlogClient, type AtriumBlogClient } from '@/lib/server/atriumBlog'
import {
  MIN_SEARCH_QUERY_LENGTH
} from '@/lib/search/constants'
import type { PostData } from './filterPublishedPosts'

const MAX_LIMIT = 50

interface SearchPostsOptions {
  query: string
  tag?: string
  includePages?: boolean
  limit?: number
  signal?: AbortSignal
  dependencies?: SearchPostsDependencies
}

export interface SearchPostsDependencies {
  client?: Pick<AtriumBlogClient, 'searchPosts'>
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }
}

export async function searchPosts({
  query,
  tag = '',
  includePages = false,
  limit = 20,
  signal,
  dependencies
}: SearchPostsOptions): Promise<PostData[]> {
  const queryValue = query.trim()
  if (Array.from(queryValue).length < MIN_SEARCH_QUERY_LENGTH) return []

  const tagValue = tag.trim()
  const safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT))

  throwIfAborted(signal)
  const client = dependencies?.client || getAtriumBlogClient()
  const posts = await client.searchPosts({
    query: queryValue,
    tag: tagValue,
    kind: includePages ? 'all' : 'post',
    limit: safeLimit,
    signal
  })
  throwIfAborted(signal)
  return posts
}
