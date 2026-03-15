import { createHmac, timingSafeEqual } from 'node:crypto'
import type { NotionDocument, PageHrefMap, PagePreviewMap } from './types'
import type { RawNotionBlock, RawNotionBlockCollection } from './normalize'
import { normalizeNotionDocument } from './normalize'
import {
  buildInternalSlugHref,
  buildNotionPublicUrl
} from './utils/notion'
import {
  buildNotionDirectoryTree,
  buildNotionDirectoryTreeSnapshot,
  refreshNotionDirectoryTreeSnapshot
} from './directoryTree'

const API_BASE_URL = 'https://api.notion.com/v1'
const DEFAULT_API_VERSION = '2025-09-03'
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_BLOCK_FETCH_CONCURRENCY = 6

type ResolvableString = string | (() => string)

function resolveConfigString(value: ResolvableString | undefined, fallback = ''): string {
  if (typeof value === 'function') {
    return `${value() || ''}`.trim() || fallback
  }
  return `${value || ''}`.trim() || fallback
}

function getRequiredValue(name: string, value: ResolvableString | undefined): string {
  const resolved = resolveConfigString(value)
  if (!resolved) {
    throw new Error(`Missing required configuration: ${name}`)
  }
  return resolved
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `Notion request failed with status ${status}`
  const message = (payload as { message?: unknown }).message
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : `Notion request failed with status ${status}`
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getPlainTextFromDirectoryRichText(items: Array<{ plain_text?: string | null }> = []): string {
  return items.map(item => `${item?.plain_text || ''}`).join('').trim()
}

function toFieldNameList(fieldNames: NotionFieldNameInput): string[] {
  return (Array.isArray(fieldNames) ? fieldNames : [fieldNames])
    .map(fieldName => `${fieldName || ''}`.trim())
    .filter(Boolean)
}

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

export function normalizeNotionUuid(id?: string): string {
  const raw = `${id || ''}`.trim()
  if (!raw) return ''

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw.toLowerCase()
  }

  const compact = raw.replaceAll('-', '')
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return [
      compact.slice(0, 8),
      compact.slice(8, 12),
      compact.slice(12, 16),
      compact.slice(16, 20),
      compact.slice(20)
    ].join('-').toLowerCase()
  }

  return raw
}

export function getPropertyByName<T>(properties: Record<string, T | undefined>, fieldName: string): T | null {
  if (!properties || !fieldName) return null
  if (properties[fieldName]) return properties[fieldName] || null

  const lowerFieldName = fieldName.toLowerCase()
  for (const [name, value] of Object.entries(properties)) {
    if (name.toLowerCase() === lowerFieldName) {
      return value || null
    }
  }

  return null
}

export function getPropertyByNames<T>(
  properties: Record<string, T | undefined>,
  fieldNames: NotionFieldNameInput
): T | null {
  for (const fieldName of toFieldNameList(fieldNames)) {
    const property = getPropertyByName(properties, fieldName)
    if (property) return property
  }
  return null
}

export function readNotionTextProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property) return ''

  switch (property.type) {
    case 'title':
      return getPlainTextFromDirectoryRichText(property.title || [])
    case 'rich_text':
      return getPlainTextFromDirectoryRichText(property.rich_text || [])
    case 'url':
      return `${property.url || ''}`.trim()
    default:
      return ''
  }
}

export function readNotionSelectProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string | null {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property) return null
  if (property.type === 'select') return property.select?.name || null
  if (property.type === 'status') return property.status?.name || null
  return null
}

export function readNotionMultiSelectProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string[] {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property || property.type !== 'multi_select') return []
  return unique((property.multi_select || []).map(item => `${item?.name || ''}`.trim()))
}

export function readNotionDateStartProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string | null {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

export function getPageParentDataSourceId(page: Pick<NotionPageLike, 'parent'>): string {
  const parent = page.parent
  if (!parent) return ''

  if (parent.type === 'data_source_id') {
    return normalizeNotionUuid(parent.data_source_id)
  }
  if (parent.type === 'database_id') {
    return normalizeNotionUuid(parent.database_id)
  }
  return ''
}

export function buildPagePathFromPage(page: Pick<NotionPageLike, 'properties'>, basePath = '', slugFieldName = 'slug'): string {
  const slug = getPlainTextFromDirectoryRichText(getPropertyByName(page.properties || {}, slugFieldName)?.rich_text || [])
  return slug ? buildInternalSlugHref(basePath, slug) : ''
}

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

export function createNotionClientFromEnv(env: Record<string, string | undefined> = process.env): NotionClient {
  return createNotionClient({
    integrationToken: () => `${env.NOTION_INTEGRATION_TOKEN || ''}`.trim(),
    notionVersion: () => `${env.NOTION_API_VERSION || ''}`.trim() || DEFAULT_API_VERSION
  })
}

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

export function tokenizeSearchQuery(
  value: string,
  { maxTokens = 5, maxTokenLength = 32 }: TokenizeSearchQueryOptions = {}
): string[] {
  if (!value) return []

  const seen = new Set<string>()
  const tokens: string[] = []
  for (const item of value.split(/\s+/)) {
    const token = item.trim().slice(0, maxTokenLength)
    if (!token || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
    if (tokens.length >= maxTokens) break
  }

  return tokens
}

export function findDataSourceProperty(
  properties: Record<string, NotionDataSourcePropertySchema | undefined>,
  candidateNames: string[],
  expectedType: string,
  allowFallbackByType = false
): NotionDataSourcePropertyRef | null {
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
    type: fallback[1].type || expectedType
  }
}

export function resolveDataSourcePropertyRefs<T extends NotionDataSourcePropertyMatchMap>(
  properties: Record<string, NotionDataSourcePropertySchema | undefined>,
  rules: T
): { [K in keyof T]: NotionDataSourcePropertyRef | null } {
  const output = {} as { [K in keyof T]: NotionDataSourcePropertyRef | null }
  for (const key of Object.keys(rules) as Array<keyof T>) {
    const rule = rules[key]
    output[key] = findDataSourceProperty(properties, rule.names, rule.type, rule.allowFallbackByType)
  }
  return output
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

async function drainWithConcurrency<T>(
  initialItems: T[],
  concurrency: number,
  worker: (item: T, enqueue: (value: T) => void) => Promise<void>
): Promise<void> {
  const queue = [...initialItems]
  let activeCount = 0

  await new Promise<void>((resolve, reject) => {
    const runNext = () => {
      if (!queue.length && activeCount === 0) {
        resolve()
        return
      }

      while (activeCount < concurrency && queue.length > 0) {
        const item = queue.shift() as T
        activeCount += 1

        void worker(item, (value) => {
          queue.push(value)
        }).then(() => {
          activeCount -= 1
          runNext()
        }).catch(reject)
      }
    }

    runNext()
  })
}

interface NotionChildBlock {
  id?: string
  has_children?: boolean
}

async function collectDocumentBlocks(
  client: NotionClient,
  pageId: string,
  blockFetchConcurrency = DEFAULT_BLOCK_FETCH_CONCURRENCY
): Promise<Record<string, RawNotionBlockCollection>> {
  const childBlocksByParentId: Record<string, RawNotionBlockCollection> = {}
  const visitedParents = new Set<string>()

  await drainWithConcurrency([pageId], blockFetchConcurrency, async (parentId, enqueue) => {
    if (!parentId || visitedParents.has(parentId)) return

    visitedParents.add(parentId)
    const children = await client.listAllBlockChildren(parentId)
    childBlocksByParentId[parentId] = children

    for (const block of children as NotionChildBlock[]) {
      const blockId = `${block?.id || ''}`.trim()
      if (!blockId || !block.has_children || visitedParents.has(blockId)) continue
      enqueue(blockId)
    }
  })

  return childBlocksByParentId
}

export async function buildNotionDocument(
  client: NotionClient,
  pageId: string,
  { includeToc = true, blockFetchConcurrency = DEFAULT_BLOCK_FETCH_CONCURRENCY }: BuildNotionDocumentOptions = {}
): Promise<NotionDocument | null> {
  if (!pageId) return null
  const childBlocksByParentId = await collectDocumentBlocks(client, pageId, blockFetchConcurrency)
  return normalizeNotionDocument({
    pageId,
    childBlocksByParentId,
    includeToc
  })
}

function getSiteHostname(siteUrl: string): string {
  const raw = `${siteUrl || ''}`.trim()
  if (!raw) return ''

  try {
    return new URL(raw).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function buildPagePreviewMap(
  items: NotionPagePreviewSource[],
  pageHrefMap: PageHrefMap,
  { siteUrl, buildImageUrl = () => '' }: BuildPagePreviewMapOptions
): PagePreviewMap {
  const hostname = getSiteHostname(siteUrl)
  const previewMap: PagePreviewMap = {}

  for (const item of items || []) {
    const id = `${item?.id || ''}`.trim()
    if (!id) continue
    previewMap[id] = {
      url: pageHrefMap[id] || buildNotionPublicUrl(id),
      hostname,
      title: `${item?.title || ''}`.trim(),
      description: `${item?.summary || ''}`.trim(),
      image: buildImageUrl(id),
      icon: '/favicon.png'
    }
  }

  return previewMap
}

function getPageTitle(properties: NotionProperties): string {
  const titleProperty = getPropertyByName(properties, 'title')
  if (titleProperty?.type === 'title') {
    return getPlainTextFromDirectoryRichText(titleProperty.title || [])
  }

  for (const property of Object.values(properties)) {
    if (property?.type === 'title') {
      return getPlainTextFromDirectoryRichText(property.title || [])
    }
  }

  return ''
}

function getRichTextPropertyValue(properties: NotionProperties, fieldName: string): string {
  const property = getPropertyByName(properties, fieldName)
  if (property?.type !== 'rich_text') return ''
  return getPlainTextFromDirectoryRichText(property.rich_text || [])
}

export function mapPageToOgData(page: NotionPageLike): PageOgData {
  const cover = page.cover
  let coverUrl = ''
  let coverType: 'external' | 'file' | null = null

  if (cover?.type === 'external') {
    coverUrl = `${cover.external?.url || ''}`.trim()
    coverType = coverUrl ? 'external' : null
  } else if (cover?.type === 'file') {
    coverUrl = `${cover.file?.url || ''}`.trim()
    coverType = coverUrl ? 'file' : null
  }

  return {
    id: `${page.id || ''}`.trim(),
    title: getPageTitle(page.properties || {}),
    summary: getRichTextPropertyValue(page.properties || {}, 'summary'),
    coverUrl,
    coverType
  }
}

const PAGE_EVENT_PREFIX = 'page.'
const DATA_SOURCE_EVENT_PREFIX = 'data_source.'
const DATABASE_EVENT_PREFIX = 'database.'
type NotionWebhookEventAction = 'home' | 'page' | 'home-and-page' | 'ignore' | 'schema'

const EVENT_ACTIONS: Record<string, NotionWebhookEventAction> = {
  'page.created': 'home',
  'page.undeleted': 'home',
  'page.content_updated': 'page',
  'page.properties_updated': 'page',
  'page.deleted': 'home-and-page',
  'page.moved': 'home-and-page',
  'data_source.created': 'home',
  'data_source.deleted': 'home',
  'data_source.moved': 'home',
  'data_source.schema_updated': 'schema',
  'data_source.content_updated': 'ignore',
  'data_source.undeleted': 'home',
  'database.created': 'home',
  'database.deleted': 'home',
  'database.moved': 'home',
  'database.schema_updated': 'schema',
  'database.content_updated': 'ignore',
  'database.undeleted': 'home'
}

export function parseNotionWebhookPayload(rawBody: string): NotionWebhookPayload {
  const trimmed = `${rawBody || ''}`.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  return isRecord(parsed) ? parsed as NotionWebhookPayload : {}
}

export function isNotionVerificationRequest(payload: NotionWebhookPayload): boolean {
  return !!`${payload.verification_token || ''}`.trim() && !`${payload.type || ''}`.trim()
}

export function computeNotionWebhookSignature(rawBody: string, verificationToken: string): string {
  return `sha256=${createHmac('sha256', verificationToken).update(rawBody).digest('hex')}`
}

export function isValidNotionWebhookSignature(rawBody: string, secret: string, signatureHeader: string | null): boolean {
  const expectedToken = secret.trim()
  const actualSignature = `${signatureHeader || ''}`.trim()
  if (!expectedToken || !actualSignature) return false

  const computedSignature = computeNotionWebhookSignature(rawBody, expectedToken)
  const left = Buffer.from(computedSignature)
  const right = Buffer.from(actualSignature)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function getEventType(payload: NotionWebhookPayload): string {
  return `${payload.type || ''}`.trim()
}

function getEntityId(payload: NotionWebhookPayload): string {
  return normalizeNotionUuid(payload.entity?.id)
}

function getParentRef(payload: NotionWebhookPayload): { id?: string, type?: string } {
  const parent = payload.data?.parent
  return isRecord(parent) ? parent as { id?: string, type?: string } : {}
}

function isRelevantPageEvent(eventType: string): boolean {
  return eventType.startsWith(PAGE_EVENT_PREFIX) && eventType in EVENT_ACTIONS
}

function isRelevantContainerEvent(eventType: string): boolean {
  return (eventType.startsWith(DATA_SOURCE_EVENT_PREFIX) || eventType.startsWith(DATABASE_EVENT_PREFIX)) && eventType in EVENT_ACTIONS
}

function getHomePath(basePath = ''): string {
  return buildInternalSlugHref(basePath, '')
}

function getPagePathFromPayload(payload: NotionWebhookPayload, basePath = ''): string {
  const properties = isRecord(payload.data?.properties) ? payload.data?.properties as NotionProperties : {}
  return buildPagePathFromPage({ properties }, basePath)
}

async function resolvePagePath(payload: NotionWebhookPayload, options: ResolveNotionWebhookOptions): Promise<string> {
  const payloadPath = getPagePathFromPayload(payload, options.basePath)
  if (payloadPath) return payloadPath

  const entityId = getEntityId(payload)
  if (!entityId || !options.resolvePagePath) return ''
  return options.resolvePagePath(entityId)
}

async function resolveTargetsForEvent(
  payload: NotionWebhookPayload,
  options: ResolveNotionWebhookOptions
): Promise<{ action: NotionWebhookResolution['action'], reason: string, shouldRefresh: boolean, resolvedPagePath: string }> {
  const eventType = getEventType(payload)
  const action = EVENT_ACTIONS[eventType]

  switch (action) {
    case 'home':
      return { action: 'home', reason: 'refresh-home', shouldRefresh: true, resolvedPagePath: '' }
    case 'page': {
      const pagePath = await resolvePagePath(payload, options)
      return pagePath
        ? { action: 'page', reason: 'refresh-page', shouldRefresh: true, resolvedPagePath: pagePath }
        : { action: 'page', reason: 'missing-page-path', shouldRefresh: false, resolvedPagePath: '' }
    }
    case 'home-and-page': {
      const pagePath = await resolvePagePath(payload, options)
      return {
        action: 'home-and-page',
        reason: 'refresh-home-and-page',
        shouldRefresh: true,
        resolvedPagePath: pagePath
      }
    }
    case 'ignore':
      return { action: 'ignore', reason: 'ignored-container-content-event', shouldRefresh: false, resolvedPagePath: '' }
    case 'schema':
      return { action: 'schema', reason: 'refresh-schema', shouldRefresh: true, resolvedPagePath: '' }
    default:
      return { action: 'home', reason: 'refresh-home', shouldRefresh: true, resolvedPagePath: '' }
  }
}

async function matchesConfiguredDataSource(payload: NotionWebhookPayload, options: ResolveNotionWebhookOptions): Promise<boolean> {
  const configuredId = normalizeNotionUuid(options.configuredDataSourceId)
  if (!configuredId) return true

  const eventType = getEventType(payload)
  const entityId = getEntityId(payload)
  const parent = getParentRef(payload)
  const parentId = normalizeNotionUuid(parent.id)

  if (eventType.startsWith(DATA_SOURCE_EVENT_PREFIX) && entityId) {
    return entityId === configuredId
  }

  if (eventType.startsWith(DATABASE_EVENT_PREFIX)) {
    return true
  }

  if (!eventType.startsWith(PAGE_EVENT_PREFIX)) {
    return false
  }

  if (parentId && ['data_source', 'data_source_id', 'database', 'database_id'].includes(`${parent.type || ''}`)) {
    return parentId === configuredId
  }

  if (!entityId || !options.resolvePageParentDataSourceId) {
    return false
  }

  const resolvedParentId = normalizeNotionUuid(await options.resolvePageParentDataSourceId(entityId))
  return resolvedParentId === configuredId
}

export async function resolveNotionWebhookEvent(
  payload: NotionWebhookPayload,
  options: ResolveNotionWebhookOptions = {}
): Promise<NotionWebhookResolution> {
  const eventType = getEventType(payload)
  const entityId = getEntityId(payload)

  if (isNotionVerificationRequest(payload)) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: true,
      reason: 'verification',
      eventType: '',
      entityId: '',
      action: 'verification',
      resolvedPagePath: ''
    }
  }

  if (!eventType) {
    return {
      accepted: false,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: 'missing-event-type',
      eventType: '',
      entityId,
      action: 'invalid',
      resolvedPagePath: ''
    }
  }

  const isRelevantEvent = isRelevantPageEvent(eventType) || isRelevantContainerEvent(eventType)
  if (!isRelevantEvent) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: 'ignored-event-type',
      eventType,
      entityId,
      action: 'ignore',
      resolvedPagePath: ''
    }
  }

  const matches = await matchesConfiguredDataSource(payload, options)
  if (!matches) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: 'ignored-unrelated-entity',
      eventType,
      entityId,
      action: 'ignore',
      resolvedPagePath: ''
    }
  }

  const targets = await resolveTargetsForEvent(payload, options)
  if (!targets.shouldRefresh) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: targets.reason,
      eventType,
      entityId,
      action: targets.action,
      resolvedPagePath: ''
    }
  }

  return {
    accepted: true,
    shouldRefresh: true,
    isVerificationRequest: false,
    reason: targets.reason,
    eventType,
    entityId,
    action: targets.action,
    resolvedPagePath: targets.resolvedPagePath
  }
}

function getMultiSelectPropertyValue(property: NotionProperty | null): string[] {
  if (!property || property.type !== 'multi_select') return []
  return unique((property.multi_select || []).map(item => `${item?.name || ''}`.trim()))
}

function getPageIcon(page: NotionPageLike): string {
  const icon = page.icon
  if (!icon || typeof icon !== 'object') return ''
  if (icon.type === 'emoji') return `${icon.emoji || ''}`.trim()
  if (icon.type === 'external') return `${icon.external?.url || ''}`.trim()
  if (icon.type === 'file') return `${icon.file?.url || ''}`.trim()
  return ''
}

function deriveDefaultPageMetadata(page: NotionPageLike): NotionDerivedPageMetadata {
  const title = getPageTitle(page.properties || {})
  const summary = getRichTextPropertyValue(page.properties || {}, 'summary')
  const slug = getPlainTextFromDirectoryRichText(getPropertyByName(page.properties || {}, 'slug')?.rich_text || [])
  const tags = getMultiSelectPropertyValue(getPropertyByName(page.properties || {}, 'tags'))
  const url = buildPagePathFromPage(page) || `${page.url || ''}`.trim() || buildNotionPublicUrl(page.id)
  const icon = getPageIcon(page)
  return {
    id: `${page.id || ''}`.trim(),
    title,
    summary,
    tags,
    slug,
    url,
    icon
  }
}

export function createNotionPluginManager(
  plugins: NotionDataPlugin[] = [],
  context: NotionDataPluginContext = {}
): NotionPluginManager {
  const registeredPlugins = [...plugins]

  return {
    list() {
      return registeredPlugins
    },
    use(plugin) {
      registeredPlugins.push(plugin)
    },
    async derivePageMetadata(page) {
      let metadata = deriveDefaultPageMetadata(page)
      for (const plugin of registeredPlugins) {
        const patch = await plugin.extendPageMetadata?.(page, metadata, context)
        if (patch) {
          metadata = {
            ...metadata,
            ...patch,
            tags: patch.tags ? unique(patch.tags) : metadata.tags
          }
        }
      }
      return metadata
    },
    async resolveWebhook(payload, resolution) {
      let current = resolution
      for (const plugin of registeredPlugins) {
        const patch = await plugin.extendWebhookResolution?.(payload, current, context)
        if (patch) {
          current = {
            ...current,
            ...patch,
            resolvedPagePath: patch.resolvedPagePath ?? current.resolvedPagePath
          }
        }
      }
      return current
    }
  }
}

export function createNotionDataLayer({ client, plugins = [] }: NotionDataLayerOptions = {}): NotionDataLayer {
  const pluginManager = createNotionPluginManager(plugins, { client })
  return {
    client,
    plugins: pluginManager,
    buildDocument(pageId, options) {
      if (!client) throw new Error('Notion data layer client is not configured')
      return buildNotionDocument(client, pageId, options)
    },
    derivePageMetadata(page) {
      return pluginManager.derivePageMetadata(page)
    },
    async mapPageToOgData(page) {
      const metadata = await pluginManager.derivePageMetadata(page)
      const og = mapPageToOgData(page)
      return {
        ...og,
        title: metadata.title || og.title,
        summary: metadata.summary || og.summary
      }
    },
    buildPagePreviewMap,
    async resolveWebhookEvent(payload, options) {
      const resolution = await resolveNotionWebhookEvent(payload, options)
      return pluginManager.resolveWebhook(payload, resolution)
    }
  }
}

export {
  buildNotionDirectoryTree,
  buildNotionDirectoryTreeSnapshot,
  refreshNotionDirectoryTreeSnapshot
}