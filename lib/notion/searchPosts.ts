import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import { unstable_cache } from 'next/cache'
import {
  MAX_SEARCH_KEYWORD_TOKENS,
  MAX_SEARCH_TOKEN_LENGTH,
  MIN_SEARCH_QUERY_LENGTH
} from '@/lib/search/constants'
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
  signal?: AbortSignal
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

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase()
}

function tokenizeKeyword(value: string): string[] {
  if (!value) return []

  const seen = new Set<string>()
  const tokens: string[] = []

  for (const item of value.split(/\s+/)) {
    const token = item.trim().slice(0, MAX_SEARCH_TOKEN_LENGTH)
    if (!token || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
    if (tokens.length >= MAX_SEARCH_KEYWORD_TOKENS) break
  }

  return tokens
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

const getSearchPropertyRefsCached = unstable_cache(
  async (dataSourceId: string): Promise<SearchPropertyRefs> => {
    const dataSource = await api.retrieveDataSource(dataSourceId)
    const properties = dataSource?.properties || {}
    return {
      title: findDataSourceProperty(properties, ['title', 'name'], 'title', true),
      summary: findDataSourceProperty(properties, ['summary', 'description'], 'rich_text'),
      tags: findDataSourceProperty(properties, ['tags', 'tag'], 'multi_select')
    }
  },
  ['notion-search-property-refs'],
  { revalidate: DATA_SOURCE_SCHEMA_CACHE_TTL_MS / 1000, tags: ['notion-search-schema'] }
)

async function getSearchPropertyRefs(dataSourceId: string, signal?: AbortSignal): Promise<SearchPropertyRefs> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const refs = await getSearchPropertyRefsCached(dataSourceId)
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  return refs
}

function buildSearchFilter(
  keywordTokens: string[],
  tag: string,
  refs: SearchPropertyRefs
): Record<string, unknown> | null {
  const andFilters: Record<string, unknown>[] = []

  if (tag && refs.tags) {
    andFilters.push({
      property: refs.tags.id,
      multi_select: {
        contains: tag
      }
    })
  }

  if (keywordTokens.length) {
    const tokenFilters: Record<string, unknown>[] = []

    for (const token of keywordTokens) {
      const fieldFilters: Record<string, unknown>[] = []

      if (refs.title) {
        fieldFilters.push({
          property: refs.title.id,
          title: {
            contains: token
          }
        })
      }
      if (refs.summary) {
        fieldFilters.push({
          property: refs.summary.id,
          rich_text: {
            contains: token
          }
        })
      }
      if (refs.tags) {
        fieldFilters.push({
          property: refs.tags.id,
          multi_select: {
            contains: token
          }
        })
      }

      if (fieldFilters.length === 1) {
        tokenFilters.push(fieldFilters[0])
      } else if (fieldFilters.length > 1) {
        tokenFilters.push({
          or: fieldFilters
        })
      }
    }

    if (tokenFilters.length === 1) {
      andFilters.push(tokenFilters[0])
    } else if (tokenFilters.length > 1) {
      andFilters.push({
        and: tokenFilters
      })
    }
  }

  if (andFilters.length === 0) return null
  if (andFilters.length === 1) return andFilters[0]
  return { and: andFilters }
}

function matchesKeywordAndTag(post: PostData, keywordTokens: string[], normalizedTag: string): boolean {
  if (normalizedTag) {
    const postTags = (post.tags || []).map(item => normalizeForMatch(item))
    if (!postTags.includes(normalizedTag)) {
      return false
    }
  }

  if (!keywordTokens.length) {
    return true
  }

  const combined = normalizeForMatch(`${post.title || ''} ${post.summary || ''} ${(post.tags || []).join(' ')}`)
  return keywordTokens.every(token => combined.includes(token))
}

export async function searchPosts({
  query,
  tag = '',
  includePages = false,
  limit = 20,
  signal
}: SearchPostsOptions): Promise<PostData[]> {
  const queryValue = query.trim()
  if (Array.from(queryValue).length < MIN_SEARCH_QUERY_LENGTH) return []

  const keywordTokensRaw = tokenizeKeyword(queryValue)
  const keywordTokens = keywordTokensRaw.map(token => normalizeForMatch(token))
  const tagValue = tag.trim()
  const normalizedTag = normalizeForMatch(tagValue)
  if (!keywordTokensRaw.length && !tagValue) return []

  const dataSourceId = normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const refs = await getSearchPropertyRefs(dataSourceId, signal)
  const filter = buildSearchFilter(keywordTokensRaw, tagValue, refs)
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
    }, signal)

    const pageResults = (response?.results || []) as any[]
    const mapped = pageResults.map(mapPageToPost).filter(post => post?.id)
    const filtered = filterPublishedPosts({ posts: mapped, includePages })

    for (const post of filtered) {
      if (!matchesKeywordAndTag(post, keywordTokens, normalizedTag)) continue
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
