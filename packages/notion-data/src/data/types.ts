import type { NotionDocument, PageHrefMap, PagePreviewMap } from '@jihuayu/notion-type'
import type { RawNotionBlock } from '@jihuayu/notion-type/normalize'

export type ResolvableString = string | (() => string)

export interface NotionRichTextItem {
  plain_text?: string | null
}

export interface NotionSelectOption {
  name?: string | null
}

export interface NotionProperty {
  type?: string
  title?: NotionRichTextItem[]
  rich_text?: NotionRichTextItem[]
  url?: string | null
  select?: NotionSelectOption | null
  status?: NotionSelectOption | null
  multi_select?: NotionSelectOption[]
  date?: {
    start?: string | null
  } | null
  relation?: Array<{ id?: string | null }>
}

export type NotionProperties = Record<string, NotionProperty | undefined>

export interface NotionPageParent {
  type?: string
  data_source_id?: string
  database_id?: string
}

export interface NotionPageLike {
  id: string
  url?: string | null
  created_time: string
  last_edited_time: string
  properties: NotionProperties
  parent?: NotionPageParent | null
  cover?: {
    type?: string
    external?: { url?: string | null } | null
    file?: { url?: string | null } | null
  } | null
  icon?: {
    type?: 'emoji' | 'external' | 'file'
    emoji?: string | null
    external?: { url?: string | null } | null
    file?: { url?: string | null } | null
  } | null
}

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

export interface BuildNotionDocumentOptions {
  includeToc?: boolean
  blockFetchConcurrency?: number
}

export type NotionFieldNameInput = string | string[]

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

export interface NotionPagePreviewSource {
  id: string
  title?: string | null
  summary?: string | null
}

export interface BuildPagePreviewMapOptions {
  siteUrl: string
  buildImageUrl?: (pageId: string) => string
}

export interface PageOgData {
  id: string
  title: string
  summary: string
  coverUrl: string
  coverType: 'external' | 'file' | null
}

export interface ResolveNotionWebhookOptions {
  configuredDataSourceId?: string
  basePath?: string
  resolvePageParentDataSourceId?: (pageId: string) => Promise<string>
  resolvePagePath?: (pageId: string) => Promise<string>
}

export interface NotionWebhookPayload {
  verification_token?: string
  type?: string
  entity?: {
    id?: string
    type?: string
  }
  data?: {
    parent?: { id?: string, type?: string }
    [key: string]: unknown
  }
  [key: string]: unknown
}

export interface NotionWebhookResolution {
  accepted: boolean
  shouldRefresh: boolean
  isVerificationRequest: boolean
  reason: string
  eventType: string
  entityId: string
  action: 'verification' | 'ignore' | 'home' | 'page' | 'home-and-page' | 'schema' | 'invalid'
  resolvedPagePath: string
}

export interface NotionDerivedPageMetadata {
  id: string
  title: string
  summary: string
  tags: string[]
  slug: string
  url: string
  icon: string
}

export interface NotionDataPluginContext {
  client?: NotionClient
}

export interface NotionDataPlugin {
  name: string
  extendPageMetadata?: (
    page: NotionPageLike,
    metadata: NotionDerivedPageMetadata,
    context: NotionDataPluginContext
  ) => Partial<NotionDerivedPageMetadata> | void | Promise<Partial<NotionDerivedPageMetadata> | void>
  extendWebhookResolution?: (
    payload: NotionWebhookPayload,
    resolution: NotionWebhookResolution,
    context: NotionDataPluginContext
  ) => Partial<NotionWebhookResolution> | void | Promise<Partial<NotionWebhookResolution> | void>
}

export interface NotionPluginManager {
  list(): readonly NotionDataPlugin[]
  use(plugin: NotionDataPlugin): void
  derivePageMetadata(page: NotionPageLike): Promise<NotionDerivedPageMetadata>
  resolveWebhook(payload: NotionWebhookPayload, resolution: NotionWebhookResolution): Promise<NotionWebhookResolution>
}

export interface NotionDataLayerOptions {
  client?: NotionClient
  plugins?: NotionDataPlugin[]
}

export interface NotionDataLayer {
  client?: NotionClient
  plugins: NotionPluginManager
  buildDocument(pageId: string, options?: BuildNotionDocumentOptions): Promise<NotionDocument | null>
  derivePageMetadata(page: NotionPageLike): Promise<NotionDerivedPageMetadata>
  mapPageToOgData(page: NotionPageLike): Promise<PageOgData>
  buildPagePreviewMap(items: NotionPagePreviewSource[], pageHrefMap: PageHrefMap, options: BuildPagePreviewMapOptions): PagePreviewMap
  resolveWebhookEvent(payload: NotionWebhookPayload, options?: ResolveNotionWebhookOptions): Promise<NotionWebhookResolution>
}
