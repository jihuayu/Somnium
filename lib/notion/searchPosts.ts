import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import {
  getPageParentDataSourceId,
  mapPageToPost,
  normalizeNotionUuid
} from './postMapper'

const MAX_PAGE_FETCHES = 5
const MAX_LIMIT = 50

interface SearchPostsOptions {
  query: string
  includePages?: boolean
  limit?: number
}

export async function searchPosts({
  query,
  includePages = false,
  limit = 20
}: SearchPostsOptions): Promise<PostData[]> {
  const keyword = query.trim()
  if (!keyword) return []

  const dataSourceId = normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT))
  const results: PostData[] = []
  const seenIds = new Set<string>()
  let nextCursor: string | null = null
  let pageCount = 0

  do {
    const response = await api.search({
      query: keyword,
      filter: {
        property: 'object',
        value: 'page'
      },
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      },
      page_size: 100,
      ...(nextCursor ? { start_cursor: nextCursor } : {})
    })

    const pageResults = (response?.results || []) as any[]
    const dataSourcePages = pageResults.filter(
      page => getPageParentDataSourceId(page) === dataSourceId
    )

    const mapped = dataSourcePages.map(mapPageToPost).filter(post => post?.id)
    const filtered = filterPublishedPosts({ posts: mapped, includePages })

    for (const post of filtered) {
      if (seenIds.has(post.id)) continue
      seenIds.add(post.id)
      results.push(post)
      if (results.length >= safeLimit) break
    }

    if (results.length >= safeLimit) break
    nextCursor = response?.has_more ? response?.next_cursor : null
    pageCount += 1
  } while (nextCursor && pageCount < MAX_PAGE_FETCHES)

  if (BLOG.sortByDate) {
    results.sort((a, b) => b.date - a.date)
  }

  return results.slice(0, safeLimit)
}
