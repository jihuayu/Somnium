import 'server-only'
import type { NotionDocument } from '@jihuayu/notion-type'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

const DEFAULT_PAGE_SIZE = 100
const DEFAULT_MAX_TRAVERSAL_ATTEMPTS = 2
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000
const DEFAULT_MAX_PAGES_PER_TRAVERSAL = 500
const DEFAULT_MAX_POSTS_PER_TRAVERSAL = 50_000

type AtriumPostKind = 'post' | 'page' | 'all'

interface AtriumMeta {
  schemaVersion: 1
  revision: string
  syncedAt: string | null
  nextCursor?: string | null
}

interface AtriumEnvelope<T> {
  data: T
  meta: AtriumMeta
}

export interface AtriumTag {
  name: string
  count: number
}

export interface AtriumPageOgData {
  id: string
  title: string
  summary: string
  coverUrl: string
  coverType: 'external' | 'file' | null
}

export interface AtriumBlogRequestOptions {
  signal?: AbortSignal
}

export interface AtriumBlogListPostsOptions extends AtriumBlogRequestOptions {
  kind?: AtriumPostKind
  tag?: string
  cursor?: string
  limit?: number
}

export interface AtriumBlogSearchOptions extends AtriumBlogRequestOptions {
  query: string
  tag?: string
  kind?: AtriumPostKind
  limit?: number
}

export interface AtriumBlogClient {
  listPosts(options?: AtriumBlogListPostsOptions): Promise<AtriumEnvelope<PostData[]>>
  listAllPosts(options?: Omit<AtriumBlogListPostsOptions, 'cursor' | 'limit'>): Promise<PostData[]>
  getPostBySlug(slug: string, options?: AtriumBlogRequestOptions): Promise<PostData>
  getPostDocument(pageId: string, options?: AtriumBlogRequestOptions): Promise<NotionDocument>
  getPostOg(pageId: string, options?: AtriumBlogRequestOptions): Promise<AtriumPageOgData>
  getTags(options?: AtriumBlogRequestOptions): Promise<AtriumTag[]>
  searchPosts(options: AtriumBlogSearchOptions): Promise<PostData[]>
}

export interface AtriumBlogClientOptions {
  baseUrl?: string
  env?: Record<string, string | undefined>
  fetchImplementation?: typeof fetch
  maxTraversalAttempts?: number
  requestTimeoutMs?: number
  maxPagesPerTraversal?: number
  maxPostsPerTraversal?: number
}

export class AtriumBlogApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, { status, code = '' }: { status: number, code?: string }) {
    super(message)
    this.name = 'AtriumBlogApiError'
    this.status = status
    this.code = code
  }
}

export class AtriumBlogResponseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AtriumBlogResponseError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function assertStringArray(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}: expected an array of strings`)
  }
}

function assertPostData(value: unknown, label: string): asserts value is PostData {
  if (!isRecord(value)) {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}: expected an object`)
  }

  const requiredStringFields = ['id', 'title', 'slug', 'summary'] as const
  for (const field of requiredStringFields) {
    if (typeof value[field] !== 'string') {
      throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}: missing ${field}`)
    }
  }
  if (!asTrimmedString(value.id) || !asTrimmedString(value.title) || !asTrimmedString(value.slug)) {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}: missing a required identifier`)
  }

  assertStringArray(value.tags, `${label}.tags`)
  assertStringArray(value.type, `${label}.type`)
  assertStringArray(value.status, `${label}.status`)

  if (!Array.isArray(value.formats) || value.formats.some(format => format !== 'wide' && format !== 'codeHeavy')) {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}.formats`)
  }

  if (typeof value.fullWidth !== 'boolean') {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}: missing fullWidth`)
  }

  if (typeof value.date !== 'number' || !Number.isFinite(value.date)) {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}: invalid date`)
  }
}

function assertDocument(value: unknown): asserts value is NotionDocument {
  if (!isRecord(value)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog document: expected an object')
  }

  if (!asTrimmedString(value.pageId)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog document: missing pageId')
  }

  assertStringArray(value.rootIds, 'document.rootIds')
  if (!isRecord(value.blocksById)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog document: missing blocksById')
  }
  if (!isRecord(value.childrenById)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog document: missing childrenById')
  }

  for (const childIds of Object.values(value.childrenById)) {
    assertStringArray(childIds, 'document.childrenById')
  }

  if (value.toc !== undefined) {
    if (!Array.isArray(value.toc) || value.toc.some(item => (
      !isRecord(item) ||
      !asTrimmedString(item.id) ||
      typeof item.text !== 'string' ||
      typeof item.indentLevel !== 'number' ||
      !Number.isFinite(item.indentLevel)
    ))) {
      throw new AtriumBlogResponseError('Invalid Atrium Blog document.toc')
    }
  }
}

function assertPageOgData(value: unknown): asserts value is AtriumPageOgData {
  if (!isRecord(value)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog OG response: expected an object')
  }

  for (const field of ['id', 'title', 'summary', 'coverUrl'] as const) {
    if (typeof value[field] !== 'string') {
      throw new AtriumBlogResponseError(`Invalid Atrium Blog OG response: missing ${field}`)
    }
  }

  if (value.coverType !== 'external' && value.coverType !== 'file' && value.coverType !== null) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog OG response: invalid coverType')
  }
}

function assertTags(value: unknown): asserts value is AtriumTag[] {
  if (!Array.isArray(value)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog tags response: expected an array')
  }

  for (const tag of value) {
    if (!isRecord(tag) || !asTrimmedString(tag.name) || typeof tag.count !== 'number' || !Number.isSafeInteger(tag.count) || tag.count < 0) {
      throw new AtriumBlogResponseError('Invalid Atrium Blog tag entry')
    }
  }
}

function assertMeta(value: unknown): asserts value is AtriumMeta {
  if (!isRecord(value)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog response: missing meta')
  }

  if (value.schemaVersion !== 1) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog response: unsupported schemaVersion')
  }
  if (!asTrimmedString(value.revision)) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog response: missing revision')
  }
  if (value.syncedAt !== null && typeof value.syncedAt !== 'string') {
    throw new AtriumBlogResponseError('Invalid Atrium Blog response: invalid syncedAt')
  }
  if (value.nextCursor !== undefined && value.nextCursor !== null && typeof value.nextCursor !== 'string') {
    throw new AtriumBlogResponseError('Invalid Atrium Blog response: invalid nextCursor')
  }
}

function assertEnvelope<T>(value: unknown, assertData: (data: unknown) => asserts data is T): asserts value is AtriumEnvelope<T> {
  if (!isRecord(value) || !Object.prototype.hasOwnProperty.call(value, 'data')) {
    throw new AtriumBlogResponseError('Invalid Atrium Blog response: missing data')
  }

  assertData(value.data)
  assertMeta(value.meta)
}

function parseApiError(payload: unknown, status: number): AtriumBlogApiError {
  const error = isRecord(payload) && isRecord(payload.error) ? payload.error : null
  const code = error ? asTrimmedString(error.code) : ''
  const message = error ? asTrimmedString(error.message) : ''
  return new AtriumBlogApiError(
    message || `Atrium Blog API request failed with status ${status}`,
    { status, code }
  )
}

async function readJson(response: Response): Promise<unknown> {
  const body = await response.text()
  if (!body.trim()) return null

  try {
    return JSON.parse(body)
  } catch {
    return null
  }
}

function assertIdentifier(value: string, label: string): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > 512 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new AtriumBlogResponseError(`Invalid Atrium Blog ${label}`)
  }
  return normalized
}

export function getAtriumBlogApiUrl(env: Record<string, string | undefined> = process.env): string {
  const configured = `${env.ATRIUM_BLOG_API_URL || ''}`.trim()
  if (!configured) {
    throw new AtriumBlogResponseError('Missing required environment variable: ATRIUM_BLOG_API_URL')
  }

  try {
    const url = new URL(configured)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('unsupported protocol')
    }
    if (url.username || url.password || url.search || url.hash) {
      throw new Error('unsafe URL')
    }
    return url.toString().replace(/\/+$/, '')
  } catch {
    throw new AtriumBlogResponseError('Invalid ATRIUM_BLOG_API_URL')
  }
}

export function isAtriumBlogNotFoundError(error: unknown): error is AtriumBlogApiError {
  return error instanceof AtriumBlogApiError && error.status === 404
}

function boundedPositiveInteger(value: number | undefined, fallback: number, maximum: number): number {
  return Math.max(1, Math.min(Math.floor(value || fallback) || fallback, maximum))
}

function createTimeoutError(): Error {
  const error = new Error('Atrium Blog request timed out')
  error.name = 'TimeoutError'
  return error
}

function combineAbortSignals(signal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal
  cleanup: () => void
} {
  const controller = new AbortController()
  const onCallerAbort = () => controller.abort(signal?.reason)
  const timeout = setTimeout(() => controller.abort(createTimeoutError()), timeoutMs)

  if (signal?.aborted) {
    onCallerAbort()
  } else {
    signal?.addEventListener('abort', onCallerAbort, { once: true })
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', onCallerAbort)
    }
  }
}

export function createAtriumBlogClient({
  baseUrl,
  env = process.env,
  fetchImplementation = fetch,
  maxTraversalAttempts = DEFAULT_MAX_TRAVERSAL_ATTEMPTS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  maxPagesPerTraversal = DEFAULT_MAX_PAGES_PER_TRAVERSAL,
  maxPostsPerTraversal = DEFAULT_MAX_POSTS_PER_TRAVERSAL
}: AtriumBlogClientOptions = {}): AtriumBlogClient {
  const normalizedBaseUrl = (baseUrl || getAtriumBlogApiUrl(env)).replace(/\/+$/, '')
  const safeTraversalAttempts = Math.max(1, Math.min(Math.floor(maxTraversalAttempts) || 1, 3))
  const safeRequestTimeoutMs = boundedPositiveInteger(requestTimeoutMs, DEFAULT_REQUEST_TIMEOUT_MS, 60_000)
  const safeMaxPagesPerTraversal = boundedPositiveInteger(maxPagesPerTraversal, DEFAULT_MAX_PAGES_PER_TRAVERSAL, 10_000)
  const safeMaxPostsPerTraversal = boundedPositiveInteger(maxPostsPerTraversal, DEFAULT_MAX_POSTS_PER_TRAVERSAL, 1_000_000)

  async function request<T>(
    path: string,
    searchParams: URLSearchParams,
    options: AtriumBlogRequestOptions,
    assertData: (data: unknown) => asserts data is T
  ): Promise<AtriumEnvelope<T>> {
    const requestSignal = combineAbortSignals(options.signal, safeRequestTimeoutMs)
    try {
      const response = await fetchImplementation(`${normalizedBaseUrl}${path}${searchParams.size ? `?${searchParams.toString()}` : ''}`, {
        method: 'GET',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: requestSignal.signal
      })
      const payload = await readJson(response)

      if (!response.ok) {
        throw parseApiError(payload, response.status)
      }

      assertEnvelope(payload, assertData)
      return payload
    } finally {
      // Keep the timeout live until the body has been fully consumed. fetch()
      // can resolve when headers arrive while a stalled upstream body remains.
      requestSignal.cleanup()
    }
  }

  const listPosts = async ({
    kind = 'post',
    tag = '',
    cursor = '',
    limit = DEFAULT_PAGE_SIZE,
    signal
  }: AtriumBlogListPostsOptions = {}): Promise<AtriumEnvelope<PostData[]>> => {
    const safeKind: AtriumPostKind = kind === 'page' || kind === 'all' ? kind : 'post'
    const safeLimit = Math.max(1, Math.min(Math.floor(limit) || DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE))
    const params = new URLSearchParams({ kind: safeKind, limit: String(safeLimit) })
    const normalizedTag = tag.trim()
    const normalizedCursor = cursor.trim()
    if (normalizedTag) params.set('tag', normalizedTag)
    if (normalizedCursor) params.set('cursor', normalizedCursor)

    return request('/posts', params, { signal }, (data): asserts data is PostData[] => {
      if (!Array.isArray(data)) {
        throw new AtriumBlogResponseError('Invalid Atrium Blog posts response: expected an array')
      }
      data.forEach((post, index) => assertPostData(post, `posts[${index}]`))
    })
  }

  const listAllPosts = async ({ kind = 'post', tag = '', signal }: Omit<AtriumBlogListPostsOptions, 'cursor' | 'limit'> = {}): Promise<PostData[]> => {
    for (let traversalAttempt = 0; traversalAttempt < safeTraversalAttempts; traversalAttempt += 1) {
      const posts: PostData[] = []
      const seenCursors = new Set<string>()
      let cursor = ''
      let pageCount = 0

      try {
        do {
          if (pageCount >= safeMaxPagesPerTraversal) {
            throw new AtriumBlogResponseError('Atrium Blog pagination exceeded the page limit')
          }
          const page = await listPosts({ kind, tag, cursor, limit: DEFAULT_PAGE_SIZE, signal })
          pageCount += 1
          posts.push(...page.data)
          if (posts.length > safeMaxPostsPerTraversal) {
            throw new AtriumBlogResponseError('Atrium Blog pagination exceeded the result limit')
          }
          const nextCursor = page.meta.nextCursor || ''
          if (nextCursor && seenCursors.has(nextCursor)) {
            throw new AtriumBlogResponseError('Atrium Blog pagination returned a repeated cursor')
          }
          if (nextCursor) seenCursors.add(nextCursor)
          cursor = nextCursor
        } while (cursor)

        return posts
      } catch (error) {
        if (!(error instanceof AtriumBlogApiError) || error.status !== 409 || error.code !== 'cursor_expired' || traversalAttempt + 1 >= safeTraversalAttempts) {
          throw error
        }
      }
    }

    throw new AtriumBlogResponseError('Atrium Blog pagination could not complete')
  }

  const getPostBySlug = async (slug: string, { signal }: AtriumBlogRequestOptions = {}): Promise<PostData> => {
    const params = new URLSearchParams({ slug: assertIdentifier(slug, 'slug') })
    const response = await request('/posts/by-slug', params, { signal }, (data): asserts data is PostData => {
      assertPostData(data, 'post')
    })
    return response.data
  }

  const getPostDocument = async (pageId: string, { signal }: AtriumBlogRequestOptions = {}): Promise<NotionDocument> => {
    const response = await request(`/posts/${encodeURIComponent(assertIdentifier(pageId, 'pageId'))}/document`, new URLSearchParams(), { signal }, assertDocument)
    return response.data
  }

  const getPostOg = async (pageId: string, { signal }: AtriumBlogRequestOptions = {}): Promise<AtriumPageOgData> => {
    const response = await request(`/posts/${encodeURIComponent(assertIdentifier(pageId, 'pageId'))}/og`, new URLSearchParams(), { signal }, assertPageOgData)
    return response.data
  }

  const getTags = async ({ signal }: AtriumBlogRequestOptions = {}): Promise<AtriumTag[]> => {
    const response = await request('/tags', new URLSearchParams(), { signal }, assertTags)
    return response.data
  }

  const searchPosts = async ({
    query,
    tag = '',
    kind = 'post',
    limit = 20,
    signal
  }: AtriumBlogSearchOptions): Promise<PostData[]> => {
    const safeKind: AtriumPostKind = kind === 'page' || kind === 'all' ? kind : 'post'
    const safeLimit = Math.max(1, Math.min(Math.floor(limit) || 20, 50))
    const params = new URLSearchParams({
      q: assertIdentifier(query, 'search query'),
      kind: safeKind,
      limit: String(safeLimit)
    })
    const normalizedTag = tag.trim()
    if (normalizedTag) params.set('tag', normalizedTag)

    const response = await request('/search', params, { signal }, (data): asserts data is PostData[] => {
      if (!Array.isArray(data)) {
        throw new AtriumBlogResponseError('Invalid Atrium Blog search response: expected an array')
      }
      data.forEach((post, index) => assertPostData(post, `search[${index}]`))
    })
    return response.data
  }

  return {
    listPosts,
    listAllPosts,
    getPostBySlug,
    getPostDocument,
    getPostOg,
    getTags,
    searchPosts
  }
}

export function getAtriumBlogClient(): AtriumBlogClient {
  return createAtriumBlogClient()
}
