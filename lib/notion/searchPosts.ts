import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapPageToPost, normalizeNotionUuid } from './postMapper'

const MAX_PAGE_FETCHES = 10
const MAX_LIMIT = 50
const DATA_SOURCE_SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000

interface SearchPostsOptions {
  query: string
  tag?: string
  includePages?: boolean
  limit?: number
}

interface DataSourcePropertyRef {
  id: string
  type: string
}

interface SearchPropertyRefs {
  title: DataSourcePropertyRef | null
  summary: DataSourcePropertyRef | null
  tags: DataSourcePropertyRef | null
}

let cachedSearchPropertyRefs: {
  dataSourceId: string
  expiresAt: number
  refs: SearchPropertyRefs
} | null = null

function normalizeKeyword(value: string): string {
  return value.trim().toLowerCase()
}

function normalizeTag(value: string): string {
  return value.trim().toLowerCase()
}

function findDataSourceProperty(
  properties: Record<string, any>,
  candidateNames: string[],
  expectedType: string,
  allowFallbackByType = false
): DataSourcePropertyRef | null {
  const normalizedCandidates = candidateNames.map(name => name.toLowerCase())
  const entries = Object.entries(properties || {})

  for (const [name, property] of entries) {
    if (!property || property.type !== expectedType) continue
    if (!normalizedCandidates.includes(name.toLowerCase())) continue
    return {
      id: property.id || name,
      type: property.type
    }
  }

  if (!allowFallbackByType) return null
  const fallback = entries.find(([, property]) => property?.type === expectedType)
  if (!fallback) return null

  return {
    id: fallback[1].id || fallback[0],
    type: fallback[1].type
  }
}

async function getSearchPropertyRefs(dataSourceId: string): Promise<SearchPropertyRefs> {
  const now = Date.now()
  if (
    cachedSearchPropertyRefs &&
    cachedSearchPropertyRefs.dataSourceId === dataSourceId &&
    cachedSearchPropertyRefs.expiresAt > now
  ) {
    return cachedSearchPropertyRefs.refs
  }

  const dataSource = await api.retrieveDataSource(dataSourceId)
  const properties = dataSource?.properties || {}
  const refs: SearchPropertyRefs = {
    title: findDataSourceProperty(properties, ['title', 'name'], 'title', true),
    summary: findDataSourceProperty(properties, ['summary', 'description'], 'rich_text'),
    tags: findDataSourceProperty(properties, ['tags', 'tag'], 'multi_select')
  }

  cachedSearchPropertyRefs = {
    dataSourceId,
    expiresAt: now + DATA_SOURCE_SCHEMA_CACHE_TTL_MS,
    refs
  }
  return refs
}

function buildSearchFilter(keyword: string, tag: string, refs: SearchPropertyRefs): Record<string, unknown> | null {
  const andFilters: Record<string, unknown>[] = []

  if (tag && refs.tags) {
    andFilters.push({
      property: refs.tags.id,
      multi_select: {
        contains: tag
      }
    })
  }

  if (keyword) {
    const keywordFilters: Record<string, unknown>[] = []
    if (refs.title) {
      keywordFilters.push({
        property: refs.title.id,
        title: {
          contains: keyword
        }
      })
    }
    if (refs.summary) {
      keywordFilters.push({
        property: refs.summary.id,
        rich_text: {
          contains: keyword
        }
      })
    }
    if (refs.tags) {
      keywordFilters.push({
        property: refs.tags.id,
        multi_select: {
          contains: keyword
        }
      })
    }

    if (keywordFilters.length === 1) {
      andFilters.push(keywordFilters[0])
    } else if (keywordFilters.length > 1) {
      andFilters.push({
        or: keywordFilters
      })
    }
  }

  if (andFilters.length === 0) return null
  if (andFilters.length === 1) return andFilters[0]
  return { and: andFilters }
}

function matchesKeywordAndTag(post: PostData, keyword: string, tag: string): boolean {
  if (tag) {
    const postTags = (post.tags || []).map(item => normalizeTag(item))
    if (!postTags.includes(tag)) {
      return false
    }
  }

  if (!keyword) {
    return true
  }

  const combined = `${post.title || ''} ${post.summary || ''} ${(post.tags || []).join(' ')}`.toLowerCase()
  return combined.includes(keyword)
}

export async function searchPosts({
  query,
  tag = '',
  includePages = false,
  limit = 20
}: SearchPostsOptions): Promise<PostData[]> {
  const keyword = normalizeKeyword(query)
  const normalizedTag = normalizeTag(tag)
  if (!keyword && !normalizedTag) return []

  const dataSourceId = normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const refs = await getSearchPropertyRefs(dataSourceId)
  const filter = buildSearchFilter(keyword, normalizedTag, refs)
  const safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT))
  const results: PostData[] = []
  const seenIds = new Set<string>()
  let nextCursor: string | null = null
  let pageCount = 0

  do {
    const response = await api.queryDataSource(dataSourceId, {
      ...(filter ? { filter } : {}),
      page_size: 100,
      sorts: [
        {
          timestamp: 'last_edited_time',
          direction: 'descending'
        }
      ],
      ...(nextCursor ? { start_cursor: nextCursor } : {})
    })

    const pageResults = (response?.results || []) as any[]
    const mapped = pageResults.map(mapPageToPost).filter(post => post?.id)
    const filtered = filterPublishedPosts({ posts: mapped, includePages })

    for (const post of filtered) {
      if (!matchesKeywordAndTag(post, keyword, normalizedTag)) continue
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
