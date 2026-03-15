import type { RawNotionBlock } from '@jihuayu/notion-type/normalize'
import {
  API_BASE_URL,
  DEFAULT_API_VERSION,
  DEFAULT_MAX_RETRIES,
  getRequiredValue,
  isRecord,
  normalizeErrorMessage,
  resolveConfigString,
  sleep
} from './shared'
import type {
  NotionApiError,
  NotionBlockChildrenResponse,
  NotionClient,
  NotionClientOptions,
  NotionDataSourceQueryResponse,
  NotionDataSourceResponse,
  NotionPageResponse,
  NotionPaginatedResponse,
  NotionRequestOptions,
  NotionSearchResponse,
  NotionTextSearchClause,
  QueryAllDataSourceEntriesOptions
} from './types'

function assertNotionPageResponse(value: unknown): asserts value is NotionPageResponse {
  if (!isRecord(value)) {
    throw new Error('Invalid Notion page response: expected object')
  }

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  if (!id) {
    throw new Error('Invalid Notion page response: missing id')
  }

  if (typeof value.created_time !== 'string' || !value.created_time.trim()) {
    throw new Error(`Invalid Notion page response for ${id}: missing created_time`)
  }

  if (typeof value.last_edited_time !== 'string' || !value.last_edited_time.trim()) {
    throw new Error(`Invalid Notion page response for ${id}: missing last_edited_time`)
  }

  if (!isRecord(value.properties)) {
    throw new Error(`Invalid Notion page response for ${id}: missing properties`)
  }

  if (!isRecord(value.parent)) {
    throw new Error(`Invalid Notion page response for ${id}: missing parent`)
  }
}

function assertPaginatedResponse<T>(value: unknown, label: string): asserts value is NotionPaginatedResponse<T> {
  if (!isRecord(value)) {
    throw new Error(`Invalid Notion ${label} response: expected object`)
  }

  if (!Array.isArray(value.results)) {
    throw new Error(`Invalid Notion ${label} response: missing results array`)
  }

  if (typeof value.has_more !== 'boolean') {
    throw new Error(`Invalid Notion ${label} response: missing has_more boolean`)
  }

  if (value.next_cursor !== null && typeof value.next_cursor !== 'string') {
    throw new Error(`Invalid Notion ${label} response: invalid next_cursor`)
  }
}

/**
 * EN: Creates a Notion API client with retry/backoff and response validation.
 * ZH: 创建带重试/退避与响应校验能力的 Notion API 客户端。
 */
export function createNotionClient(options: NotionClientOptions): NotionClient {
  const notionRequest = async <T = unknown>(
    path: string,
    { method = 'GET', body, signal }: NotionRequestOptions = {}
  ): Promise<T> => {
    const token = getRequiredValue('integrationToken', options.integrationToken)
    const notionVersion = resolveConfigString(options.notionVersion, DEFAULT_API_VERSION)
    const baseUrl = resolveConfigString(options.baseUrl, API_BASE_URL)
    const fetchImplementation = options.fetchImplementation || fetch
    const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES
    const url = `${baseUrl}${path}`

    let attempt = 0
    while (true) {
      const response = await fetchImplementation(url, {
        method,
        signal,
        headers: {
          Authorization: `Bearer ${token}`,
          'Notion-Version': notionVersion,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      })

      let payload: T | null = null
      try {
        payload = await response.json() as T
      } catch {
        payload = null
      }

      const shouldRetry = response.status === 429 || (response.status >= 500 && response.status <= 599)
      if (response.ok) {
        return payload as T
      }

      if (shouldRetry && attempt < maxRetries) {
        const retryAfter = Number(response.headers.get('retry-after') || 0)
        const backoffMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(500 * (2 ** attempt), 8000)
        await sleep(backoffMs)
        attempt += 1
        continue
      }

      const error: NotionApiError = new Error(normalizeErrorMessage(payload, response.status))
      error.status = response.status
      error.payload = payload
      throw error
    }
  }

  const retrieveDataSource = async (dataSourceId: string, signal?: AbortSignal): Promise<NotionDataSourceResponse> => {
    return notionRequest<NotionDataSourceResponse>(`/data_sources/${dataSourceId}`, { signal })
  }

  const retrievePage = async (pageId: string, signal?: AbortSignal): Promise<NotionPageResponse> => {
    const response = await notionRequest<unknown>(`/pages/${pageId}`, { signal })
    assertNotionPageResponse(response)
    return response
  }

  const queryDataSource = async (
    dataSourceId: string,
    body: Record<string, unknown> = {},
    signal?: AbortSignal
  ): Promise<NotionDataSourceQueryResponse> => {
    const response = await notionRequest<unknown>(`/data_sources/${dataSourceId}/query`, {
      method: 'POST',
      body,
      signal
    })
    assertPaginatedResponse<NotionPageResponse>(response, 'data source query')
    response.results.forEach(assertNotionPageResponse)
    return response
  }

  const queryAllDataSourcePages = async (
    dataSourceId: string,
    body: Record<string, unknown> = {},
    signal?: AbortSignal
  ): Promise<NotionPageResponse[]> => {
    const results: NotionPageResponse[] = []
    let nextCursor: string | null = null

    do {
      const response = await queryDataSource(dataSourceId, {
        page_size: 100,
        ...body,
        ...(nextCursor ? { start_cursor: nextCursor } : {})
      }, signal)
      results.push(...response.results)
      nextCursor = response.has_more ? response.next_cursor : null
    } while (nextCursor)

    return results
  }

  const search = async (body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<NotionSearchResponse> => {
    const response = await notionRequest<unknown>('/search', { method: 'POST', body, signal })
    assertPaginatedResponse<Record<string, unknown>>(response, 'search')
    return response
  }

  const listBlockChildren = async (
    blockId: string,
    startCursor: string | null = null,
    signal?: AbortSignal
  ): Promise<NotionBlockChildrenResponse> => {
    const searchParams = new URLSearchParams({ page_size: '100' })
    if (startCursor) searchParams.set('start_cursor', startCursor)
    const response = await notionRequest<unknown>(`/blocks/${blockId}/children?${searchParams.toString()}`, { signal })
    assertPaginatedResponse<RawNotionBlock>(response, 'block children')
    return response
  }

  const listAllBlockChildren = async (blockId: string, signal?: AbortSignal): Promise<RawNotionBlock[]> => {
    const results: RawNotionBlock[] = []
    let nextCursor: string | null = null

    do {
      const response = await listBlockChildren(blockId, nextCursor, signal)
      results.push(...response.results)
      nextCursor = response.has_more ? response.next_cursor : null
    } while (nextCursor)

    return results
  }

  return {
    request: notionRequest,
    retrieveDataSource,
    retrievePage,
    queryDataSource,
    queryAllDataSourcePages,
    search,
    listBlockChildren,
    listAllBlockChildren
  }
}

/**
 * EN: Creates a Notion client from environment variables.
 * ZH: 从环境变量构建 Notion 客户端。
 */
export function createNotionClientFromEnv(env: Record<string, string | undefined> = process.env): NotionClient {
  return createNotionClient({
    integrationToken: () => `${env.NOTION_INTEGRATION_TOKEN || ''}`.trim(),
    notionVersion: () => `${env.NOTION_API_VERSION || ''}`.trim() || DEFAULT_API_VERSION
  })
}

/**
 * EN: Queries and maps all entries from a Notion data source.
 * ZH: 查询并映射指定数据源的全部条目。
 */
export async function queryAllDataSourceEntries<T = NotionPageResponse>(
  client: NotionClient,
  {
    dataSourceId,
    body = {},
    signal,
    mapPage,
    filterEntry,
    sortEntries
  }: QueryAllDataSourceEntriesOptions<T>
): Promise<T[]> {
  const pages = await client.queryAllDataSourcePages(dataSourceId, body, signal)
  const mapped = pages.map(page => (mapPage ? mapPage(page) : page as T))
  const filtered = filterEntry
    ? mapped.filter((entry, index) => filterEntry(entry, pages[index]))
    : mapped

  if (sortEntries) {
    filtered.sort(sortEntries)
  }

  return filtered
}

function buildTokenSearchFilter(token: string, clauses: NotionTextSearchClause[]): Record<string, unknown> | null {
  const filters = clauses.map((clause) => ({
    property: clause.propertyId,
    [clause.type]: {
      contains: token
    }
  }))

  if (!filters.length) return null
  if (filters.length === 1) return filters[0]
  return { or: filters }
}

/**
 * EN: Builds a Notion text-search filter object from tokens and clauses.
 * ZH: 基于分词结果与字段子句构造 Notion 文本检索过滤器。
 */
export function buildTextSearchFilter(
  tokens: string[],
  clauses: NotionTextSearchClause[],
  extraFilters: Record<string, unknown>[] = []
): Record<string, unknown> | null {
  const andFilters = [...extraFilters]
  for (const token of tokens) {
    const tokenFilter = buildTokenSearchFilter(token, clauses)
    if (tokenFilter) {
      andFilters.push(tokenFilter)
    }
  }

  if (!andFilters.length) return null
  if (andFilters.length === 1) return andFilters[0]
  return { and: andFilters }
}
