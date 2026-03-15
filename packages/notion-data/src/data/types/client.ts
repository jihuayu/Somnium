import type { RawNotionBlock } from '@jihuayu/notion-type/normalize'
import type { ResolvableString } from './core'
import type { NotionPageLike } from './core'

export interface NotionDataSourcePropertySchema {
  id?: string
  type?: string
  [key: string]: unknown
}

export interface NotionDataSourceResponse {
  id?: string
  properties?: Record<string, NotionDataSourcePropertySchema | undefined>
  [key: string]: unknown
}

export interface NotionPaginatedResponse<T> {
  object?: 'list' | string
  results: T[]
  has_more: boolean
  next_cursor: string | null
}

export type NotionPageResponse = NotionPageLike
export type NotionDataSourceQueryResponse = NotionPaginatedResponse<NotionPageResponse>
export type NotionSearchResponse = NotionPaginatedResponse<Record<string, unknown>>
export type NotionBlockChildrenResponse = NotionPaginatedResponse<RawNotionBlock>

export interface NotionApiError extends Error {
  status?: number
  payload?: unknown
}

export interface NotionClientOptions {
  integrationToken: ResolvableString
  notionVersion?: ResolvableString
  baseUrl?: string
  maxRetries?: number
  fetchImplementation?: typeof fetch
}

export interface NotionRequestOptions {
  method?: string
  body?: Record<string, unknown>
  signal?: AbortSignal
}

export interface NotionClient {
  request<T = unknown>(path: string, options?: NotionRequestOptions): Promise<T>
  retrieveDataSource(dataSourceId: string, signal?: AbortSignal): Promise<NotionDataSourceResponse>
  retrievePage(pageId: string, signal?: AbortSignal): Promise<NotionPageResponse>
  queryDataSource(dataSourceId: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<NotionDataSourceQueryResponse>
  queryAllDataSourcePages(dataSourceId: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<NotionPageResponse[]>
  search(body?: Record<string, unknown>, signal?: AbortSignal): Promise<NotionSearchResponse>
  listBlockChildren(blockId: string, startCursor?: string | null, signal?: AbortSignal): Promise<NotionBlockChildrenResponse>
  listAllBlockChildren(blockId: string, signal?: AbortSignal): Promise<RawNotionBlock[]>
}

export interface QueryAllDataSourceEntriesOptions<T> {
  dataSourceId: string
  body?: Record<string, unknown>
  signal?: AbortSignal
  mapPage?: (page: NotionPageResponse) => T
  filterEntry?: (entry: T, page: NotionPageResponse) => boolean
  sortEntries?: (left: T, right: T) => number
}

export interface TokenizeSearchQueryOptions {
  maxTokens?: number
  maxTokenLength?: number
}

export interface NotionDataSourcePropertyRef {
  id: string
  type: string
}

export interface NotionDataSourcePropertyMatchRule {
  names: string[]
  type: string
  allowFallbackByType?: boolean
}

export type NotionDataSourcePropertyMatchMap = Record<string, NotionDataSourcePropertyMatchRule>

export interface NotionTextSearchClause {
  propertyId: string
  type: 'title' | 'rich_text' | 'multi_select'
}
