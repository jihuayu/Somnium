import { config as BLOG } from '@/lib/server/config'
import { notionClient } from '@/lib/server/notionData'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { unstable_cache } from 'next/cache'
import {
  buildTextSearchFilter,
  resolveDataSourcePropertyRefs,
  tokenizeSearchQuery,
  type NotionClient,
  type NotionDataSourcePropertyMatchMap,
  type NotionDataSourcePropertyRef
} from '@jihuayu/notion-react/data'
import {
  MAX_SEARCH_KEYWORD_TOKENS,
  MAX_SEARCH_TOKEN_LENGTH,
  MIN_SEARCH_QUERY_LENGTH
} from '@/lib/search/constants'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapNotionPageToPost, normalizeNotionUuid } from './postAdapter'

const MAX_PAGE_FETCHES = 10
const MAX_LIMIT = 50
const DATA_SOURCE_SCHEMA_CACHE_SECONDS = ONE_DAY_SECONDS

interface SearchPostsOptions {
  query: string
  tag?: string
  includePages?: boolean
  limit?: number
  signal?: AbortSignal
  dependencies?: SearchPostsDependencies
}

interface SearchPostsDependencies {
  apiClient?: Pick<NotionClient, 'retrieveDataSource' | 'queryDataSource'>
  dataSourceId?: string
  sortByDate?: boolean
}

interface NotionDataSourceProperty {
  id?: string
  type?: string
  [key: string]: unknown
}

interface SearchPropertyRefs {
  title: NotionDataSourcePropertyRef | null
  summary: NotionDataSourcePropertyRef | null
  tags: NotionDataSourcePropertyRef | null
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase()
}

function tokenizeKeyword(value: string): string[] {
  return tokenizeSearchQuery(value, {
    maxTokens: MAX_SEARCH_KEYWORD_TOKENS,
    maxTokenLength: MAX_SEARCH_TOKEN_LENGTH
  })
}

const SEARCH_PROPERTY_RULES = {
  title: { names: ['title', 'name'], type: 'title', allowFallbackByType: true },
  summary: { names: ['summary', 'description'], type: 'rich_text' },
  tags: { names: ['tags', 'tag'], type: 'multi_select' }
} satisfies NotionDataSourcePropertyMatchMap

const getSearchPropertyRefsCached = unstable_cache(
  async (dataSourceId: string): Promise<SearchPropertyRefs> => {
    const properties = (await notionClient.retrieveDataSource(dataSourceId)).properties as Record<string, NotionDataSourceProperty | undefined> || {}
    return resolveDataSourcePropertyRefs(properties, SEARCH_PROPERTY_RULES) as SearchPropertyRefs
  },
  ['notion-search-property-refs'],
  { revalidate: DATA_SOURCE_SCHEMA_CACHE_SECONDS, tags: ['notion-search-schema'] }
)

async function buildSearchPropertyRefs(
  properties: Record<string, NotionDataSourceProperty | undefined>
): Promise<SearchPropertyRefs> {
  return resolveDataSourcePropertyRefs(properties, SEARCH_PROPERTY_RULES) as SearchPropertyRefs
}

async function getSearchPropertyRefs(
  dataSourceId: string,
  signal?: AbortSignal,
  apiClient: Pick<NotionClient, 'retrieveDataSource'> = notionClient
): Promise<SearchPropertyRefs> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const refs = apiClient === notionClient
    ? await getSearchPropertyRefsCached(dataSourceId)
    : await buildSearchPropertyRefs(
        (await apiClient.retrieveDataSource(dataSourceId)).properties as Record<string, NotionDataSourceProperty | undefined> || {}
      )
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
  const clauses = [
    refs.title ? { propertyId: refs.title.id, type: 'title' as const } : null,
    refs.summary ? { propertyId: refs.summary.id, type: 'rich_text' as const } : null,
    refs.tags ? { propertyId: refs.tags.id, type: 'multi_select' as const } : null
  ].filter((item): item is { propertyId: string, type: 'title' | 'rich_text' | 'multi_select' } => !!item)

  const extraFilters = tag && refs.tags
    ? [{
        property: refs.tags.id,
        multi_select: {
          contains: tag
        }
      }]
    : []

  return buildTextSearchFilter(keywordTokens, clauses, extraFilters)
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
  signal,
  dependencies
}: SearchPostsOptions): Promise<PostData[]> {
  const queryValue = query.trim()
  if (Array.from(queryValue).length < MIN_SEARCH_QUERY_LENGTH) return []

  const keywordTokensRaw = tokenizeKeyword(queryValue)
  const keywordTokens = keywordTokensRaw.map(token => normalizeForMatch(token))
  const tagValue = tag.trim()
  const normalizedTag = normalizeForMatch(tagValue)
  if (!keywordTokensRaw.length && !tagValue) return []

  const apiClient = dependencies?.apiClient || notionClient
  const dataSourceId = normalizeNotionUuid(dependencies?.dataSourceId || process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const refs = await getSearchPropertyRefs(dataSourceId, signal, apiClient)
  const filter = buildSearchFilter(keywordTokensRaw, tagValue, refs)
  const safeLimit = Math.max(1, Math.min(limit, MAX_LIMIT))
  const results: PostData[] = []
  const seenIds = new Set<string>()
  let nextCursor: string | null = null
  let pageCount = 0

  do {
    const response = await apiClient.queryDataSource(dataSourceId, {
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

    const pageResults = Array.isArray(response?.results) ? response.results : []
    const mapped = pageResults.map(page => mapNotionPageToPost(page)).filter(post => post?.id)
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

  if (dependencies?.sortByDate ?? BLOG.sortByDate) {
    results.sort((a, b) => b.date - a.date)
  }

  return results.slice(0, safeLimit)
}
