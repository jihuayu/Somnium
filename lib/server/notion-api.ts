import type { NotionPageLike } from '@/lib/notion/postMapper'
import type { RawNotionBlock } from '@jihuayu/notion-react/normalize'

const API_BASE_URL = 'https://api.notion.com/v1'
const DEFAULT_API_VERSION = '2025-09-03'
const MAX_RETRIES = 3

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `Notion request failed with status ${status}`
  const message = (payload as NotionErrorPayload).message
  if (typeof message === 'string' && message.length) {
    return message
  }
  return `Notion request failed with status ${status}`
}

interface RequestOptions {
  method?: string
  body?: Record<string, unknown>
  signal?: AbortSignal
}

interface NotionErrorPayload {
  message?: string | null
}

interface NotionApiError extends Error {
  status?: number
  payload?: unknown
}

interface NotionPaginatedResponse<T> {
  object?: 'list' | string
  results: T[]
  has_more: boolean
  next_cursor: string | null
}

interface NotionDataSourcePropertySchema {
  id?: string
  type?: string
  [key: string]: unknown
}

export interface NotionDataSourceResponse {
  id?: string
  properties?: Record<string, NotionDataSourcePropertySchema | undefined>
  [key: string]: unknown
}

export type NotionPageResponse = NotionPageLike
export type NotionDataSourceQueryResponse = NotionPaginatedResponse<NotionPageResponse>
export type NotionSearchResponse = NotionPaginatedResponse<Record<string, unknown>>
export type NotionBlockChildrenResponse = NotionPaginatedResponse<RawNotionBlock>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

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

async function notionRequest<T = unknown>(
  path: string,
  { method = 'GET', body, signal }: RequestOptions = {}
): Promise<T> {
  const token = getRequiredEnv('NOTION_INTEGRATION_TOKEN')
  const notionVersion = process.env.NOTION_API_VERSION || DEFAULT_API_VERSION
  const url = `${API_BASE_URL}${path}`

  let attempt = 0
  while (true) {
    const response = await fetch(url, {
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

    const shouldRetry =
      response.status === 429 ||
      (response.status >= 500 && response.status <= 599)

    if (response.ok) {
      return payload
    }

    if (shouldRetry && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after') || 0)
      const backoffMs =
        retryAfter > 0 ? retryAfter * 1000 : Math.min(500 * (2 ** attempt), 8000)
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

async function retrieveDataSource(dataSourceId: string, signal?: AbortSignal): Promise<NotionDataSourceResponse> {
  return notionRequest<NotionDataSourceResponse>(`/data_sources/${dataSourceId}`, { signal })
}

async function retrievePage(pageId: string, signal?: AbortSignal): Promise<NotionPageResponse> {
  const response = await notionRequest<unknown>(`/pages/${pageId}`, { signal })
  assertNotionPageResponse(response)
  return response
}

async function queryDataSource(
  dataSourceId: string,
  body: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<NotionDataSourceQueryResponse> {
  const response = await notionRequest<unknown>(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body,
    signal
  })
  assertPaginatedResponse<NotionPageResponse>(response, 'data source query')
  response.results.forEach(assertNotionPageResponse)
  return response
}

async function queryAllDataSourcePages(
  dataSourceId: string,
  body: Record<string, unknown> = {},
  signal?: AbortSignal
): Promise<NotionPageResponse[]> {
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

async function search(body: Record<string, unknown> = {}, signal?: AbortSignal): Promise<NotionSearchResponse> {
  const response = await notionRequest<unknown>('/search', {
    method: 'POST',
    body,
    signal
  })
  assertPaginatedResponse<Record<string, unknown>>(response, 'search')
  return response
}

async function listBlockChildren(
  blockId: string,
  startCursor: string | null = null,
  signal?: AbortSignal
): Promise<NotionBlockChildrenResponse> {
  const searchParams = new URLSearchParams({
    page_size: '100'
  })
  if (startCursor) {
    searchParams.set('start_cursor', startCursor)
  }
  const response = await notionRequest<unknown>(`/blocks/${blockId}/children?${searchParams.toString()}`, { signal })
  assertPaginatedResponse<RawNotionBlock>(response, 'block children')
  return response
}

async function listAllBlockChildren(blockId: string, signal?: AbortSignal): Promise<RawNotionBlock[]> {
  const results: RawNotionBlock[] = []
  let nextCursor: string | null = null

  do {
    const response = await listBlockChildren(blockId, nextCursor, signal)
    results.push(...response.results)
    nextCursor = response.has_more ? response.next_cursor : null
  } while (nextCursor)

  return results
}

const notionApi = {
  retrieveDataSource,
  retrievePage,
  queryDataSource,
  queryAllDataSourcePages,
  search,
  listBlockChildren,
  listAllBlockChildren
}

export { notionRequest }
export default notionApi
