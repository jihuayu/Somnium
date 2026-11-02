'use client'

import type { FormEvent, KeyboardEvent } from 'react'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react'
import {
  apiUrl,
  buildSession,
  clearStoredSession,
  COMMENT_PAGE_SIZE,
  cx,
  DEFAULT_ENDPOINT,
  formatDate,
  normalizeEndpoint,
  parseJsonResponse,
  readStoredSession,
  renderMarkdown,
  writeStoredSession,
  type AuthTokenResponse,
  type NativeUser,
  type StoredSession
} from './utils'

export type CommentLoadStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface CommentBoxLabels {
  title?: string
  caption?: string
  loading?: string
  empty?: string
  signIn?: string
  signOut?: string
  signedInAs?: string
  textareaPlaceholder?: string
  textareaDisabledPlaceholder?: string
  submit?: string
  submitting?: string
  loadMore?: string
  retry?: string
  errorTitle?: string
  authError?: string
  reply?: string
  cancelReply?: string
  replyPlaceholder?: string
  submitReply?: string
  loadMoreReplies?: string
  loadingReplies?: string
  deleteComment?: string
  banUser?: string
  bannedUser?: string
  deletedComment?: string
  confirmDelete?: (author: string) => string
  confirmBan?: (author: string) => string
  commentsCount?: (count: number) => string
}

export interface CommentBoxProps {
  endpoint?: string
  websiteKey?: string
  pageKey?: string
  pageTitle?: string
  pageUrl?: string
  documentTitle?: string
  documentUrl?: string
  requestGeoEndpoint?: string
  locale?: string
  className?: string
  labels?: CommentBoxLabels
}

interface ReactionCounts {
  like: number
  dislike: number
  heart: number
  laugh: number
  hooray: number
  confused: number
  rocket: number
  eyes: number
  total: number
}

interface AtriumWebsite {
  id: number
  key: string
  name: string
  origins?: string[]
  created_at: string
  updated_at: string
}

interface AtriumPage {
  id: number
  website_key: string
  key: string
  title: string
  url: string
  normalized_url: string
  metadata: unknown
  comment_count: number
  created_at: string
  updated_at: string
}

interface AtriumComment {
  id: number
  website_key?: string
  page_key?: string
  parent_id: number | null
  body: string
  body_html?: string
  author: NativeUser
  reactions: ReactionCounts
  deleted?: boolean
  can_delete?: boolean
  can_ban?: boolean
  created_at: string
  updated_at: string
  deleted_at?: string | null
}

interface CursorPage<T> {
  data: T[]
  pagination: {
    next_cursor: string | null
    has_more: boolean
  }
}

interface AuthMeResponse {
  user: NativeUser
  super_admin?: boolean
}

interface CommentTarget {
  websiteKey?: string
  pageKey?: string
}

type ReactionContent = 'like' | 'dislike' | 'heart' | 'laugh' | 'hooray' | 'confused' | 'rocket' | 'eyes'

interface ReactionOption {
  content: ReactionContent
  label: string
  icon: string
}

interface ReplyBucket {
  comments: AtriumComment[]
  nextCursor: string | null
  hasMore: boolean
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
}

const COMMENT_SECTION_ID = 'comments'
const subscribeNoop = () => () => {}
const browserLocationListeners = new Set<() => void>()
let browserLocationPatched = false

const defaultLabels: Required<Omit<CommentBoxLabels, 'commentsCount'>> = {
  title: '评论',
  caption: '',
  loading: '正在读取评论',
  empty: '还没有评论。',
  signIn: '登录',
  signOut: '退出',
  signedInAs: '已登录为',
  textareaPlaceholder: '写下你的想法',
  textareaDisabledPlaceholder: '登录后参与讨论',
  submit: '发布评论',
  submitting: '发布中...',
  loadMore: '加载更多',
  retry: '重试',
  errorTitle: '评论暂时不可用',
  authError: '登录状态不可用，请重新登录。',
  reply: '回复',
  cancelReply: '取消',
  replyPlaceholder: '写下你的回复',
  submitReply: '发布回复',
  loadMoreReplies: '加载更多回复',
  loadingReplies: '正在读取回复',
  deleteComment: '删除',
  banUser: '禁言',
  bannedUser: '已禁言',
  deletedComment: '该评论已被删除',
  confirmDelete: (author: string) => `确定删除 @${author} 的这条评论吗？`,
  confirmBan: (author: string) => `确定禁止 @${author} 继续在本站评论吗？`
}

const defaultCommentsCount = (count: number): string => `${count} 条评论`
const reactionOptions: ReactionOption[] = [
  { content: 'like', label: '赞', icon: '👍' },
  { content: 'dislike', label: '踩', icon: '👎' },
  { content: 'heart', label: '喜欢', icon: '❤️' },
  { content: 'laugh', label: '会心', icon: '😄' },
  { content: 'hooray', label: '庆祝', icon: '🎉' },
  { content: 'confused', label: '困惑', icon: '😕' },
  { content: 'rocket', label: '推荐', icon: '🚀' },
  { content: 'eyes', label: '围观', icon: '👀' }
]

const emptyReactions: ReactionCounts = {
  like: 0,
  dislike: 0,
  heart: 0,
  laugh: 0,
  hooray: 0,
  confused: 0,
  rocket: 0,
  eyes: 0,
  total: 0
}

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

function emitBrowserLocationChange(): void {
  browserLocationListeners.forEach(listener => listener())
}

function ensureBrowserLocationPatch(): void {
  if (browserLocationPatched || typeof window === 'undefined') return
  browserLocationPatched = true

  const originalPushState = window.history.pushState
  const originalReplaceState = window.history.replaceState
  const notify = () => {
    window.setTimeout(emitBrowserLocationChange, 0)
  }

  window.history.pushState = function pushState(this: History, ...args: Parameters<History['pushState']>) {
    const result = originalPushState.apply(this, args)
    notify()
    return result
  } as History['pushState']
  window.history.replaceState = function replaceState(this: History, ...args: Parameters<History['replaceState']>) {
    const result = originalReplaceState.apply(this, args)
    notify()
    return result
  } as History['replaceState']

  window.addEventListener('popstate', emitBrowserLocationChange)
  window.addEventListener('hashchange', emitBrowserLocationChange)
}

function subscribeBrowserLocation(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  ensureBrowserLocationPatch()
  browserLocationListeners.add(listener)
  return () => {
    browserLocationListeners.delete(listener)
  }
}

function getBrowserLocationSnapshot(): string {
  return typeof window === 'undefined' ? '' : window.location.href
}

function getServerBrowserLocationSnapshot(): string {
  return ''
}

function useBrowserLocationHref(): string {
  return useSyncExternalStore(
    subscribeBrowserLocation,
    getBrowserLocationSnapshot,
    getServerBrowserLocationSnapshot
  )
}

function requestHeaders(init?: RequestInit, session?: StoredSession | null): Headers {
  const headers = new Headers(init?.headers)
  headers.set('Accept', 'application/json')
  if (init?.body) headers.set('Content-Type', 'application/json')
  if (session?.accessToken) headers.set('Authorization', `Bearer ${session.accessToken}`)
  return headers
}

function normalizeRequestReferrer(value?: string): string | undefined {
  const trimmed = `${value || ''}`.trim()
  if (!trimmed) return undefined
  try {
    return new URL(trimmed).toString()
  } catch {
    return undefined
  }
}

async function requestNative<T>(
  endpoint: string,
  path: string,
  init?: RequestInit,
  session?: StoredSession | null,
  authenticated = false,
  referrerUrl?: string
): Promise<T> {
  const requestInit: RequestInit = {
    ...init,
    headers: requestHeaders(init, session),
    credentials: authenticated && !session?.accessToken ? 'include' : 'same-origin'
  }
  const referrer = normalizeRequestReferrer(referrerUrl)
  if (referrer) {
    requestInit.referrer = referrer
    requestInit.referrerPolicy = 'unsafe-url'
  }

  const response = await fetch(apiUrl(endpoint, path), requestInit)
  return parseJsonResponse<T>(response)
}

async function authenticateAccount(endpoint: string): Promise<StoredSession> {
  const response = await fetch(apiUrl(endpoint, '/api/v1/auth/account'), {
    method: 'POST',
    headers: {
      Accept: 'application/json'
    },
    credentials: 'include'
  })
  return buildSession(await parseJsonResponse<AuthTokenResponse>(response))
}

async function fetchMeFromCookies(endpoint: string): Promise<NativeUser | null> {
  const response = await fetch(apiUrl(endpoint, '/api/v1/auth/me'), {
    method: 'GET',
    credentials: 'include',
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) return null
  const payload = await response.json().catch(() => null) as AuthMeResponse | null
  return payload?.user ?? null
}

async function refreshSession(endpoint: string, session: StoredSession): Promise<StoredSession> {
  const response = await fetch(apiUrl(endpoint, '/api/v1/auth/refresh'), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refresh_token: session.refreshToken })
  })
  return buildSession(await parseJsonResponse<AuthTokenResponse>(response))
}

function explicitPageCommentsPath(target: CommentTarget): string | null {
  if (!target.websiteKey || !target.pageKey) return null
  return `/api/v1/websites/${encodeURIComponent(target.websiteKey)}/pages/${encodeURIComponent(target.pageKey)}/comments`
}

function pathWithQuery(path: string, query?: Record<string, string | number | null | undefined>): string {
  const params = new URLSearchParams()
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    params.set(key, String(value))
  })
  const queryString = params.toString()
  return queryString ? `${path}?${queryString}` : path
}

async function listExplicitComments(
  endpoint: string,
  path: string,
  cursor?: string | null,
  session?: StoredSession | null
): Promise<CursorPage<AtriumComment>> {
  return requestNative<CursorPage<AtriumComment>>(
    endpoint,
    pathWithQuery(path, {
      parent_id: 'root',
      limit: COMMENT_PAGE_SIZE,
      order: 'asc',
      cursor
    }),
    undefined,
    session,
    !!session
  )
}

async function listCurrentComments(
  endpoint: string,
  pageTitle: string,
  referrerUrl?: string,
  cursor?: string | null,
  session?: StoredSession | null
): Promise<CursorPage<AtriumComment>> {
  return requestNative<CursorPage<AtriumComment>>(
    endpoint,
    pathWithQuery('/api/v1/comments/current', {
      page_title: pageTitle,
      limit: COMMENT_PAGE_SIZE,
      order: 'asc',
      cursor
    }),
    undefined,
    session,
    !!session,
    referrerUrl
  )
}

async function listReplies(
  endpoint: string,
  target: CommentTarget,
  pageTitle: string,
  commentId: number,
  referrerUrl?: string,
  cursor?: string | null,
  session?: StoredSession | null
): Promise<CursorPage<AtriumComment>> {
  const explicitPath = explicitPageCommentsPath(target)
  if (explicitPath) {
    return requestNative<CursorPage<AtriumComment>>(
      endpoint,
      pathWithQuery(explicitPath, {
        parent_id: commentId,
        thread: 'flat',
        limit: COMMENT_PAGE_SIZE,
        order: 'asc',
        cursor
      }),
      undefined,
      session,
      !!session
    )
  }

  return requestNative<CursorPage<AtriumComment>>(
    endpoint,
    pathWithQuery('/api/v1/comments/current/replies', {
      comment_id: commentId,
      thread: 'flat',
      page_title: pageTitle,
      limit: COMMENT_PAGE_SIZE,
      order: 'asc',
      cursor
    }),
    undefined,
    session,
    !!session,
    referrerUrl
  )
}

interface CreateCommentOptions {
  parentId?: number | null
  referrerUrl?: string
}

async function createComment(
  endpoint: string,
  target: CommentTarget,
  pageTitle: string,
  body: string,
  session: StoredSession,
  options: CreateCommentOptions = {}
): Promise<AtriumComment> {
  const { parentId, referrerUrl } = options
  const payload = parentId == null ? { body } : { body, parent_id: parentId }
  const explicitPath = explicitPageCommentsPath(target)
  if (explicitPath) {
    return requestNative<AtriumComment>(
      endpoint,
      explicitPath,
      {
        method: 'POST',
        body: JSON.stringify(payload)
      },
      session,
      true
    )
  }

  return requestNative<AtriumComment>(
    endpoint,
    '/api/v1/comments/current',
    {
      method: 'POST',
      body: JSON.stringify({ ...payload, page_title: pageTitle })
    },
    session,
    true,
    referrerUrl
  )
}

async function setReaction(
  endpoint: string,
  target: CommentTarget,
  commentId: number,
  content: ReactionContent,
  session: StoredSession,
  referrerUrl?: string
): Promise<ReactionCounts> {
  const path = target.websiteKey
    ? `/api/v1/websites/${encodeURIComponent(target.websiteKey)}/comments/${commentId}/reactions/${content}`
    : `/api/v1/comments/current/${commentId}/reactions/${content}`
  return requestNative<ReactionCounts>(
    endpoint,
    path,
    { method: 'PUT' },
    session,
    true,
    target.websiteKey ? undefined : referrerUrl
  )
}

async function deleteReaction(
  endpoint: string,
  target: CommentTarget,
  commentId: number,
  content: ReactionContent,
  session: StoredSession,
  referrerUrl?: string
): Promise<void> {
  const path = target.websiteKey
    ? `/api/v1/websites/${encodeURIComponent(target.websiteKey)}/comments/${commentId}/reactions/${content}`
    : `/api/v1/comments/current/${commentId}/reactions/${content}`
  await requestNative<void>(
    endpoint,
    path,
    { method: 'DELETE' },
    session,
    true,
    target.websiteKey ? undefined : referrerUrl
  )
}

async function deleteComment(
  endpoint: string,
  websiteKey: string,
  commentId: number,
  session: StoredSession
): Promise<void> {
  await requestNative<void>(
    endpoint,
    `/api/v1/websites/${encodeURIComponent(websiteKey)}/comments/${commentId}`,
    { method: 'DELETE' },
    session,
    true
  )
}

async function banWebsiteUser(
  endpoint: string,
  websiteKey: string,
  userId: number,
  session: StoredSession
): Promise<void> {
  await requestNative<void>(
    endpoint,
    `/api/v1/websites/${encodeURIComponent(websiteKey)}/bans`,
    {
      method: 'POST',
      body: JSON.stringify({ user_id: userId })
    },
    session,
    true
  )
}

function reactionKey(commentId: number, content: ReactionContent): string {
  return `${commentId}:${content}`
}

function adjustReactionCounts(reactions: ReactionCounts, content: ReactionContent, delta: number): ReactionCounts {
  const nextValue = Math.max(0, reactions[content] + delta)
  const nextTotal = Math.max(0, reactions.total + delta)
  return { ...reactions, [content]: nextValue, total: nextTotal }
}

function findThreadRootId(
  parentId: number,
  rootComments: AtriumComment[],
  buckets: Record<number, ReplyBucket>
): number {
  if (rootComments.some(comment => comment.id === parentId)) return parentId
  for (const [rootId, bucket] of Object.entries(buckets)) {
    if (bucket.comments.some(comment => comment.id === parentId)) return Number(rootId)
  }
  return parentId
}

function displayName(user: NativeUser): string {
  return user.display_name || user.login
}

function withCommentSectionHash(value: string): string {
  try {
    const url = new URL(value)
    url.hash = COMMENT_SECTION_ID
    return url.toString()
  } catch {
    return value
  }
}

export function CommentBox({
  endpoint = DEFAULT_ENDPOINT,
  websiteKey,
  pageKey,
  pageTitle,
  pageUrl,
  documentTitle = '',
  documentUrl = '',
  requestGeoEndpoint = '/api/request-geo',
  locale = 'zh-CN',
  className,
  labels
}: CommentBoxProps) {
  const isHydrated = useIsHydrated()
  const browserLocationHref = useBrowserLocationHref()
  const sectionRef = useRef<HTMLElement | null>(null)
  const loadRequestRef = useRef(0)
  const [enabled, setEnabled] = useState(false)
  const [suppressed, setSuppressed] = useState(false)
  const [status, setStatus] = useState<CommentLoadStatus>('idle')
  const [page, setPage] = useState<AtriumPage | null>(null)
  const [website, setWebsite] = useState<AtriumWebsite | null>(null)
  const [comments, setComments] = useState<AtriumComment[]>([])
  const [replyBuckets, setReplyBuckets] = useState<Record<number, ReplyBucket>>({})
  const [replyingTo, setReplyingTo] = useState<number | null>(null)
  const [reactionBusy, setReactionBusy] = useState<Record<string, boolean>>({})
  const [activeReactions, setActiveReactions] = useState<Record<string, boolean>>({})
  const [reactionPickerFor, setReactionPickerFor] = useState<number | null>(null)
  const [commentActionBusy, setCommentActionBusy] = useState<Record<string, boolean>>({})
  const [bannedAuthors, setBannedAuthors] = useState<Record<number, boolean>>({})
  const [renderedHtml, setRenderedHtml] = useState<Record<number, string>>({})
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [session, setSession] = useState<StoredSession | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [composing, setComposing] = useState(false)
  const [mentionQuery, setMentionQuery] = useState<{ start: number; query: string } | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)

  const copy = { ...defaultLabels, ...labels }
  const commentsCountLabel = labels?.commentsCount ?? defaultCommentsCount
  const normalizedEndpoint = useMemo(() => normalizeEndpoint(endpoint), [endpoint])
  const target = useMemo<CommentTarget>(() => ({ websiteKey, pageKey }), [pageKey, websiteKey])
  const pageTitleValue = pageTitle || documentTitle || (pageKey ? String(pageKey) : 'Untitled')
  const storageScope = normalizedEndpoint
  const resolvedWebsiteKey = target.websiteKey || page?.website_key || website?.key || ''
  const visibleComments = useMemo(() => {
    const replies = Object.values(replyBuckets).flatMap(bucket => bucket.comments)
    return [...comments, ...replies]
  }, [comments, replyBuckets])

  // Participants: everyone who has commented or replied in this thread,
  // plus the current user (so they can mention themselves if they want).
  const participants = useMemo(() => {
    const set = new Set<string>()
    for (const c of visibleComments) set.add(displayName(c.author))
    if (session) set.add(displayName(session.user))
    return set
  }, [visibleComments, session])
  const mentionSuggestions = useMemo(() => {
    if (!mentionQuery) return []
    const q = mentionQuery.query.toLowerCase()
    return Array.from(participants)
      .filter(login => login.toLowerCase().startsWith(q))
      .slice(0, 5)
  }, [mentionQuery, participants])

  const currentDocumentUrl = useMemo(() => {
    if (isHydrated) {
      if (pageUrl) {
        try {
          const configured = new URL(pageUrl)
          const browserLocation = browserLocationHref ? new URL(browserLocationHref) : null
          if (!browserLocation || configured.origin === browserLocation.origin) return configured.toString()
        } catch {
          // Fall back to the browser location below.
        }
      }
      if (browserLocationHref) return browserLocationHref
      if (typeof window !== 'undefined') return window.location.href
    }
    if (pageUrl) return pageUrl
    if (documentUrl) return documentUrl
    return ''
  }, [browserLocationHref, documentUrl, isHydrated, pageUrl])

  const signInUrl = useMemo(() => {
    if (!isHydrated || typeof window === 'undefined') return '#'
    const url = new URL(window.location.href)
    const returnUrl = withCommentSectionHash(url.href)
    return apiUrl(normalizedEndpoint, '/api/v1/auth/account/authorize', {
      redirect_uri: returnUrl,
      state: pageKey || currentDocumentUrl || returnUrl
    })
  }, [currentDocumentUrl, isHydrated, normalizedEndpoint, pageKey])

  const ensureFreshSession = useCallback(async (current: StoredSession | null): Promise<StoredSession | null> => {
    if (!current) return null
    if (current.accessToken && current.expiresAt > Date.now()) return current
    if (current.refreshToken) {
      const refreshed = await refreshSession(normalizedEndpoint, current)
      writeStoredSession(storageScope, refreshed)
      setSession(refreshed)
      return refreshed
    }
    return current
  }, [normalizedEndpoint, storageScope])

  const sessionForRead = useCallback(async (): Promise<StoredSession | null> => {
    if (!session) return null
    try {
      return await ensureFreshSession(session)
    } catch {
      return null
    }
  }, [ensureFreshSession, session])

  const updateCommentEverywhere = useCallback((commentId: number, updater: (comment: AtriumComment) => AtriumComment) => {
    setComments(current => current.map(comment => comment.id === commentId ? updater(comment) : comment))
    setReplyBuckets(current => {
      let changed = false
      const next: Record<number, ReplyBucket> = {}
      Object.entries(current).forEach(([key, bucket]) => {
        let bucketChanged = false
        const comments = bucket.comments.map(comment => {
          if (comment.id !== commentId) return comment
          bucketChanged = true
          return updater(comment)
        })
        if (bucketChanged) changed = true
        next[Number(key)] = bucketChanged ? { ...bucket, comments } : bucket
      })
      return changed ? next : current
    })
  }, [])

  const markCommentDeletedEverywhere = useCallback((commentId: number) => {
    const deletedAt = new Date().toISOString()
    const markDeleted = (comment: AtriumComment): AtriumComment => {
      if (comment.id !== commentId) return comment
      return {
        ...comment,
        body: '',
        body_html: '',
        reactions: { ...emptyReactions },
        deleted: true,
        deleted_at: comment.deleted_at ?? deletedAt
      }
    }

    setComments(current => current.map(markDeleted))
    setReplyBuckets(current => {
      let changed = false
      const next: Record<number, ReplyBucket> = {}
      Object.entries(current).forEach(([key, bucket]) => {
        const parentId = Number(key)
        let bucketChanged = false
        const comments = bucket.comments.map(comment => {
          if (comment.id !== commentId) return comment
          bucketChanged = true
          return markDeleted(comment)
        })
        if (bucketChanged) changed = true
        next[parentId] = bucketChanged ? { ...bucket, comments } : bucket
      })
      return changed ? next : current
    })
    setReactionPickerFor(current => current === commentId ? null : current)
    setActiveReactions(current => {
      let changed = false
      const next = { ...current }
      reactionOptions.forEach(option => {
        const key = reactionKey(commentId, option.content)
        if (next[key]) changed = true
        next[key] = false
      })
      return changed ? next : current
    })
  }, [])

  const loadRepliesForComment = useCallback(async (
    commentId: number,
    cursor?: string | null,
    requestId = loadRequestRef.current
  ) => {
    if (requestId !== loadRequestRef.current) return

    setReplyBuckets(current => {
      if (requestId !== loadRequestRef.current) return current
      const existing = current[commentId]
      return {
        ...current,
        [commentId]: {
          comments: existing?.comments ?? [],
          nextCursor: existing?.nextCursor ?? null,
          hasMore: existing?.hasMore ?? false,
          status: 'loading'
        }
      }
    })

    try {
      const readSession = await sessionForRead()
      const page = await listReplies(normalizedEndpoint, target, pageTitleValue, commentId, currentDocumentUrl, cursor, readSession)
      if (requestId !== loadRequestRef.current) return
      setReplyBuckets(current => {
        if (requestId !== loadRequestRef.current) return current
        const existing = current[commentId]
        const previous = cursor ? existing?.comments ?? [] : []
        return {
          ...current,
          [commentId]: {
            comments: [...previous, ...page.data],
            nextCursor: page.pagination.next_cursor,
            hasMore: page.pagination.has_more,
            status: 'ready'
          }
        }
      })
    } catch (err) {
      if (requestId !== loadRequestRef.current) return
      setReplyBuckets(current => {
        if (requestId !== loadRequestRef.current) return current
        const existing = current[commentId]
        return {
          ...current,
          [commentId]: {
            comments: existing?.comments ?? [],
            nextCursor: existing?.nextCursor ?? null,
            hasMore: existing?.hasMore ?? false,
            status: 'error',
            error: err instanceof Error ? err.message : copy.errorTitle
          }
        }
      })
    }
  }, [copy.errorTitle, currentDocumentUrl, normalizedEndpoint, pageTitleValue, sessionForRead, target])

  const loadInitial = useCallback(async () => {
    const requestId = loadRequestRef.current + 1
    loadRequestRef.current = requestId
    setStatus('loading')
    setError('')
    setWebsite(null)
    setPage(null)
    setComments([])
    setReplyBuckets({})
    setRenderedHtml({})
    setNextCursor(null)
    setHasMore(false)
    setReplyingTo(null)
    setReactionPickerFor(null)
    setReactionBusy({})
    setActiveReactions({})
    setCommentActionBusy({})
    setBannedAuthors({})
    setComposing(false)
    setMentionQuery(null)
    setMentionIndex(0)

    const readSession = await sessionForRead()
    const explicitPath = explicitPageCommentsPath(target)
    const loaded = explicitPath
      ? {
          website: null,
          page: null,
          comments: await listExplicitComments(normalizedEndpoint, explicitPath, undefined, readSession)
        }
      : await listCurrentComments(normalizedEndpoint, pageTitleValue, currentDocumentUrl, undefined, readSession).then(comments => ({
          website: null,
          page: null,
          comments
        }))

    if (requestId !== loadRequestRef.current) return
    setWebsite(loaded.website)
    setPage(loaded.page)
    setComments(loaded.comments.data)
    setReplyBuckets({})
    setNextCursor(loaded.comments.pagination.next_cursor)
    setHasMore(loaded.comments.pagination.has_more)
    setStatus('ready')
    loaded.comments.data.forEach(comment => {
      void loadRepliesForComment(comment.id, undefined, requestId)
    })
  }, [currentDocumentUrl, loadRepliesForComment, normalizedEndpoint, pageTitleValue, sessionForRead, target])

  useEffect(() => {
    if (!isHydrated) return undefined
    const stored = readStoredSession(storageScope)
    if (stored) {
      setSession(stored)
      return undefined
    }

    let cancelled = false
    ;(async () => {
      try {
        const next = await authenticateAccount(normalizedEndpoint)
        if (cancelled) return
        writeStoredSession(storageScope, next)
        setSession(next)
      } catch {
        try {
          const user = await fetchMeFromCookies(normalizedEndpoint)
          if (cancelled || !user) return
          setSession({
            accessToken: '',
            refreshToken: '',
            expiresAt: Number.MAX_SAFE_INTEGER,
            user
          })
        } catch {
          // Anonymous reads are valid; auth is only required for writes.
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isHydrated, normalizedEndpoint, storageScope])

  useEffect(() => {
    if (!isHydrated || typeof window === 'undefined') return undefined
    if (window.location.hash !== `#${COMMENT_SECTION_ID}`) return undefined

    const frame = window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: 'start' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [isHydrated, session])

  useEffect(() => {
    if (enabled || suppressed) return undefined

    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    let controller: AbortController | null = null
    let cancelled = false

    const activate = async () => {
      controller = new AbortController()
      try {
        const response = await fetch(requestGeoEndpoint, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store'
        })
        const payload = await response.json().catch(() => null)
        if (cancelled || controller.signal.aborted) return
        if (response.ok && payload?.hideComments === true) {
          setSuppressed(true)
          return
        }
      } catch {
        if (cancelled || controller?.signal.aborted) return
      }
      if (!cancelled) setEnabled(true)
    }

    const scheduleActivate = () => {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        idleId = window.requestIdleCallback(activate, { timeout: 2500 })
      } else {
        idleTimer = globalThis.setTimeout(activate, 1200)
      }
    }

    scheduleActivate()

    return () => {
      cancelled = true
      controller?.abort()
      if (idleId !== null && typeof window !== 'undefined' && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId)
      }
      if (idleTimer !== null) globalThis.clearTimeout(idleTimer)
    }
  }, [enabled, requestGeoEndpoint, suppressed])

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    ;(async () => {
      try {
        await loadInitial()
      } catch (err) {
        if (cancelled) return
        setStatus('error')
        setError(err instanceof Error ? err.message : copy.errorTitle)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [copy.errorTitle, enabled, loadInitial])

  useEffect(() => {
    if (visibleComments.length === 0) {
      setRenderedHtml({})
      return undefined
    }
    let cancelled = false
    ;(async () => {
      const next: Record<number, string> = {}
      await Promise.all(visibleComments.map(async comment => {
        next[comment.id] = await renderMarkdown(comment.body, participants)
      }))
      if (!cancelled) setRenderedHtml(next)
    })()
    return () => {
      cancelled = true
    }
  }, [visibleComments, participants])

  const handleLoadMore = async () => {
    if (!hasMore || busy) return
    setBusy(true)
    setError('')
    try {
      const readSession = await sessionForRead()
      const explicitPath = explicitPageCommentsPath(target)
      const loaded = explicitPath
        ? await listExplicitComments(normalizedEndpoint, explicitPath, nextCursor, readSession)
        : await listCurrentComments(normalizedEndpoint, pageTitleValue, currentDocumentUrl, nextCursor, readSession)
      setComments(current => [...current, ...loaded.data])
      setNextCursor(loaded.pagination.next_cursor)
      setHasMore(loaded.pagination.has_more)
      loaded.data.forEach(comment => {
        void loadRepliesForComment(comment.id)
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  const submitDraft = async () => {
    const body = draft.trim()
    if (!body || busy) return

    setBusy(true)
    setError('')
    const parentId = replyingTo
    const threadRootId = parentId == null ? null : findThreadRootId(parentId, comments, replyBuckets)
    try {
      const freshSession = await ensureFreshSession(session)
      if (!freshSession) {
        setError(copy.authError)
        return
      }

      const comment = await createComment(normalizedEndpoint, target, pageTitleValue, body, freshSession, {
        parentId,
        referrerUrl: currentDocumentUrl
      })
      if (parentId == null) {
        setComments(current => [...current, comment])
      } else {
        setReplyBuckets(current => {
          const bucketId = threadRootId ?? parentId
          const existing = current[bucketId]
          return {
            ...current,
            [bucketId]: {
              comments: [...(existing?.comments ?? []), comment],
              nextCursor: existing?.nextCursor ?? null,
              hasMore: existing?.hasMore ?? false,
              status: 'ready'
            }
          }
        })
        setReplyingTo(null)
      }
      setPage(current => current ? { ...current, comment_count: current.comment_count + 1 } : current)
      setDraft('')
      setComposing(false)
      setStatus('ready')
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setBusy(false)
    }
  }

  const handleReaction = async (comment: AtriumComment, content: ReactionContent) => {
    if (comment.deleted) return
    const key = reactionKey(comment.id, content)
    if (reactionBusy[key]) return

    setReactionBusy(current => ({ ...current, [key]: true }))
    setError('')
    try {
      const freshSession = await ensureFreshSession(session)
      if (!freshSession) {
        setError(copy.authError)
        return
      }

      if (activeReactions[key]) {
        await deleteReaction(normalizedEndpoint, target, comment.id, content, freshSession, currentDocumentUrl)
        setActiveReactions(current => ({ ...current, [key]: false }))
        updateCommentEverywhere(comment.id, current => ({
          ...current,
          reactions: adjustReactionCounts(current.reactions, content, -1)
        }))
      } else {
        const reactions = await setReaction(normalizedEndpoint, target, comment.id, content, freshSession, currentDocumentUrl)
        setActiveReactions(current => ({ ...current, [key]: true }))
        updateCommentEverywhere(comment.id, current => ({ ...current, reactions }))
      }
      setReactionPickerFor(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setReactionBusy(current => ({ ...current, [key]: false }))
    }
  }

  const handleDeleteComment = async (comment: AtriumComment) => {
    const key = `delete:${comment.id}`
    const websiteKey = comment.website_key || resolvedWebsiteKey
    if (!websiteKey || comment.deleted || comment.can_delete !== true || commentActionBusy[key]) return
    if (typeof window !== 'undefined' && !window.confirm(copy.confirmDelete(displayName(comment.author)))) return

    setCommentActionBusy(current => ({ ...current, [key]: true }))
    setError('')
    try {
      const freshSession = await ensureFreshSession(session)
      if (!freshSession) {
        setError(copy.authError)
        return
      }

      await deleteComment(normalizedEndpoint, websiteKey, comment.id, freshSession)
      markCommentDeletedEverywhere(comment.id)
      setReplyingTo(current => current === comment.id ? null : current)
      setPage(current => current ? { ...current, comment_count: Math.max(0, current.comment_count - 1) } : current)
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setCommentActionBusy(current => ({ ...current, [key]: false }))
    }
  }

  const handleBanUser = async (comment: AtriumComment) => {
    const key = `ban:${comment.author.id}`
    const websiteKey = comment.website_key || resolvedWebsiteKey
    if (!websiteKey || comment.deleted || comment.can_ban !== true || commentActionBusy[key]) return
    if (typeof window !== 'undefined' && !window.confirm(copy.confirmBan(displayName(comment.author)))) return

    setCommentActionBusy(current => ({ ...current, [key]: true }))
    setError('')
    try {
      const freshSession = await ensureFreshSession(session)
      if (!freshSession) {
        setError(copy.authError)
        return
      }

      await banWebsiteUser(normalizedEndpoint, websiteKey, comment.author.id, freshSession)
      setBannedAuthors(current => ({ ...current, [comment.author.id]: true }))
      updateCommentEverywhere(comment.id, current => ({ ...current, can_ban: false }))
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.errorTitle)
    } finally {
      setCommentActionBusy(current => ({ ...current, [key]: false }))
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submitDraft()
  }

  const handleSignOut = async () => {
    clearStoredSession(storageScope)
    try {
      await fetch(apiUrl(normalizedEndpoint, '/api/v1/auth/session'), {
        method: 'DELETE',
        credentials: 'include'
      })
    } catch {
      // Best effort; local state is cleared either way.
    }
    setSession(null)
  }

  if (suppressed) return null

  const isLoading = status === 'idle' || status === 'loading'
  const canSubmit = !!session && draft.trim().length > 0 && !busy
  const totalCount = page?.comment_count ?? visibleComments.length
  const replyTarget = visibleComments.find(comment => comment.id === replyingTo) ?? null
  const isReplying = replyingTo !== null

  const handleComposerChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = event.currentTarget.value
    const caret = event.currentTarget.selectionStart ?? value.length
    setDraft(value)

    // Detect @mention pattern at caret position
    const beforeCaret = value.slice(0, caret)
    const atMatch = beforeCaret.match(/(?:^|[\s(])@([A-Za-z0-9_-]*)$/)
    if (atMatch) {
      const atStart = caret - atMatch[0].length + atMatch[0].indexOf('@')
      setMentionQuery({ start: atStart, query: atMatch[1] })
      setMentionIndex(0)
    } else {
      setMentionQuery(null)
    }
  }

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery && mentionSuggestions.length > 0) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setMentionIndex(i => (i + 1) % mentionSuggestions.length)
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setMentionIndex(i => (i - 1 + mentionSuggestions.length) % mentionSuggestions.length)
        return
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        insertMention(mentionSuggestions[mentionIndex])
        return
      }
      if (event.key === 'Escape') {
        event.preventDefault()
        setMentionQuery(null)
        return
      }
    }
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      void submitDraft()
    }
  }

  const insertMention = (login: string) => {
    const textarea = composerRef.current
    if (!textarea || !mentionQuery) return
    const before = draft.slice(0, mentionQuery.start)
    const after = draft.slice(textarea.selectionStart ?? draft.length)
    const inserted = `@${login} `
    const nextDraft = before + inserted + after
    setDraft(nextDraft)
    setMentionQuery(null)
    const newCaret = before.length + inserted.length
    window.requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(newCaret, newCaret)
    })
  }
  const focusComposerForReply = (commentId: number) => {
    setReactionPickerFor(null)
    if (replyingTo === commentId) {
      setReplyingTo(null)
      return
    }
    setReplyingTo(commentId)
    setComposing(true)
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        composerRef.current?.scrollIntoView({ block: 'center' })
        composerRef.current?.focus()
      })
    }
  }
  const renderReactionPicker = (comment: AtriumComment) => {
    if (reactionPickerFor !== comment.id) return null

    return (
      <div className="absolute left-0 top-full z-10 mt-2 flex items-center gap-1 rounded-md border border-stone-200 bg-white p-1 shadow-sm dark:border-stone-800 dark:bg-stone-950">
        {reactionOptions.map(option => {
          const key = reactionKey(comment.id, option.content)
          const active = activeReactions[key] === true
          return (
            <button
              key={option.content}
              type="button"
              disabled={!session || reactionBusy[key]}
              aria-label={option.label}
              aria-pressed={active}
              title={option.label}
              onClick={() => void handleReaction(comment, option.content)}
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-md text-base leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'bg-stone-200 text-stone-950 dark:bg-stone-800 dark:text-stone-100'
                  : 'hover:bg-stone-100 dark:hover:bg-stone-900'
              )}
            >
              <span aria-hidden="true">{option.icon}</span>
            </button>
          )
        })}
      </div>
    )
  }

  const renderActions = (comment: AtriumComment, allowReply: boolean) => {
    if (comment.deleted) return null

    const deleteKey = `delete:${comment.id}`
    const banKey = `ban:${comment.author.id}`
    const actionWebsiteKey = comment.website_key || resolvedWebsiteKey
    const authorBanned = bannedAuthors[comment.author.id] === true
    const canDeleteComment = !!session && !!actionWebsiteKey && comment.can_delete === true
    const canBanAuthor = !!session && !!actionWebsiteKey && comment.can_ban === true

    return (
      <div className="relative mt-3 flex flex-wrap items-center gap-2 text-xs text-stone-400 dark:text-stone-600">
        {reactionOptions.map(option => {
          const key = reactionKey(comment.id, option.content)
          const active = activeReactions[key] === true
          const count = comment.reactions[option.content]
          const visibleCount = active ? Math.max(1, count) : count
          if (visibleCount <= 0) return null

          return (
            <button
              key={option.content}
              type="button"
              disabled={!session || reactionBusy[key]}
              aria-label={`${option.label} ${visibleCount}`}
              aria-pressed={active}
              title={option.label}
              onClick={() => void handleReaction(comment, option.content)}
              className={cx(
                'inline-flex h-7 items-center gap-1 rounded-full border px-2 text-sm leading-none transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
                active
                  ? 'border-stone-400 bg-stone-200/70 text-stone-950 dark:border-stone-600 dark:bg-stone-800/80 dark:text-stone-100'
                  : 'border-stone-200 bg-white/55 text-stone-700 hover:border-stone-300 hover:bg-white dark:border-stone-800 dark:bg-stone-950/30 dark:text-stone-300 dark:hover:border-stone-700 dark:hover:bg-stone-950/70'
              )}
            >
              <span aria-hidden="true">{option.icon}</span>
              <span>{visibleCount}</span>
            </button>
          )
        })}
        <button
          type="button"
          disabled={!session}
          aria-label="添加表情"
          aria-expanded={reactionPickerFor === comment.id}
          title="添加表情"
          onClick={() => setReactionPickerFor(current => current === comment.id ? null : comment.id)}
          className={cx(
            'inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white/55 text-sm leading-none text-stone-500 transition-colors duration-150 hover:border-stone-300 hover:bg-white hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-stone-800 dark:bg-stone-950/30 dark:text-stone-500 dark:hover:border-stone-700 dark:hover:bg-stone-950/70 dark:hover:text-stone-200',
            reactionPickerFor === comment.id && 'border-stone-400 text-stone-900 dark:border-stone-600 dark:text-stone-100'
          )}
        >
          <span aria-hidden="true" className="relative inline-flex h-4 w-4 items-center justify-center">
            <span className="text-[15px]">☺</span>
            <span className="absolute -right-1 -top-1 text-[10px] font-semibold leading-none">+</span>
          </span>
        </button>
        {renderReactionPicker(comment)}
        {allowReply && (
          <button
            type="button"
            disabled={!session}
            onClick={() => focusComposerForReply(comment.id)}
            className={cx(
              'ml-1 transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
              replyingTo === comment.id
                ? 'font-medium text-stone-800 dark:text-stone-200'
                : 'text-stone-500 hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-200'
            )}
          >
            {replyingTo === comment.id ? copy.cancelReply : copy.reply}
          </button>
        )}
        {canDeleteComment && (
          <button
            type="button"
            disabled={commentActionBusy[deleteKey]}
            onClick={() => void handleDeleteComment(comment)}
            className="ml-1 text-stone-500 transition-colors duration-150 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-500 dark:hover:text-red-400"
          >
            {copy.deleteComment}
          </button>
        )}
        {canBanAuthor && (
          <button
            type="button"
            disabled={authorBanned || commentActionBusy[banKey]}
            onClick={() => void handleBanUser(comment)}
            className="text-stone-500 transition-colors duration-150 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40 dark:text-stone-500 dark:hover:text-red-400"
          >
            {authorBanned ? copy.bannedUser : copy.banUser}
          </button>
        )}
      </div>
    )
  }

  const renderReplies = (comment: AtriumComment) => {
    const bucket = replyBuckets[comment.id]
    if (!bucket || (bucket.status === 'ready' && bucket.comments.length === 0 && !bucket.hasMore)) {
      return null
    }

    return (
      <div className="mt-3 space-y-0.5">
        {bucket.status === 'loading' && bucket.comments.length === 0 && (
          <p className="py-2 pl-11 text-xs text-stone-400 dark:text-stone-600">
            {copy.loadingReplies}
          </p>
        )}
        {bucket.comments.length > 0 && bucket.comments.map(reply => renderCommentArticle(reply, false))}
        {bucket.status === 'error' && (
          <button
            type="button"
            onClick={() => void loadRepliesForComment(comment.id, bucket.nextCursor)}
            className="pl-11 text-xs font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-200"
          >
            {bucket.error || copy.retry}
          </button>
        )}
        {bucket.hasMore && (
          <button
            type="button"
            onClick={() => void loadRepliesForComment(comment.id, bucket.nextCursor)}
            className="pl-11 text-xs font-medium text-stone-500 transition-colors hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-200"
          >
            {copy.loadMoreReplies}
          </button>
        )}
      </div>
    )
  }

  const renderCommentArticle = (comment: AtriumComment, allowReply: boolean) => {
    const hasReplies = allowReply && replyBuckets[comment.id] && (
      replyBuckets[comment.id].comments.length > 0 ||
      replyBuckets[comment.id].status === 'loading' ||
      replyBuckets[comment.id].hasMore
    )
    return (
      <article key={comment.id} className={allowReply ? 'px-5 py-5' : 'py-3'}>
        <div className="flex gap-3">
          {/* Avatar column with threading line */}
          <div className="flex shrink-0 flex-col items-center">
            {comment.author.avatar_url ? (
              <img
                src={comment.author.avatar_url}
                alt=""
                className="h-8 w-8 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900"
              />
            ) : (
              <div className="h-8 w-8 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900" />
            )}
            {hasReplies && (
              <div className="mt-1 w-px flex-1 bg-stone-200 dark:bg-stone-800" />
            )}
          </div>
          {/* Content column */}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">
                {displayName(comment.author)}
              </p>
              <time className="shrink-0 text-xs text-stone-400 dark:text-stone-600">
                {formatDate(comment.created_at, locale)}
              </time>
            </div>
            {comment.deleted ? (
              <div className="comment-body mt-2 break-words text-[0.95rem] leading-7 text-stone-700 dark:text-stone-300">
                {copy.deletedComment}
              </div>
            ) : (
              <div
                className="comment-body mt-2 break-words text-[0.95rem] leading-7 text-stone-700 dark:text-stone-300"
                dangerouslySetInnerHTML={{ __html: renderedHtml[comment.id] ?? '' }}
              />
            )}
            {renderActions(comment, true)}
            {allowReply && renderReplies(comment)}
          </div>
        </div>
      </article>
    )
  }

  return (
    <section
      ref={sectionRef}
      id={COMMENT_SECTION_ID}
      aria-labelledby="comments-title"
      className={cx(
        'my-10 border-t border-stone-200/80 pt-6 text-stone-700 dark:border-stone-800/90 dark:text-stone-300',
        className
      )}
    >
      <header className="mb-5">
        <h2 id="comments-title" className="font-sans text-xl font-medium text-stone-900 dark:text-stone-100">
          <span>{copy.title}</span>
          {status === 'ready' && totalCount > 0 && (
            <span className="ml-2 align-middle text-sm font-normal text-stone-600 dark:text-stone-400">
              {commentsCountLabel(totalCount)}
            </span>
          )}
        </h2>
        {copy.caption && (
          <p className="mt-1 text-sm leading-6 text-stone-600 dark:text-stone-400">
            {copy.caption}
          </p>
        )}
      </header>

      <div
        className="rounded-md border border-stone-200/75 bg-stone-50/45 dark:border-stone-800/80 dark:bg-stone-950/20"
        role="status"
        aria-live="polite"
      >
        {isLoading && (
          <div className="px-5 py-6">
            <div className="h-3 w-24 rounded-full bg-stone-200/80 dark:bg-stone-800/90" />
            <div className="mt-5 space-y-3">
              <div className="h-3 w-full max-w-[32rem] rounded-full bg-stone-200/65 dark:bg-stone-800/70" />
              <div className="h-3 w-2/3 rounded-full bg-stone-200/55 dark:bg-stone-800/60" />
            </div>
            <p className="mt-5 text-sm font-medium text-stone-500 dark:text-stone-500">
              {copy.loading}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div className="px-5 py-6">
            <p className="text-sm font-semibold text-stone-800 dark:text-stone-200">
              {copy.errorTitle}
            </p>
            {error && (
              <p className="mt-2 text-sm leading-6 text-stone-500 dark:text-stone-500">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={loadInitial}
              className="mt-4 rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors duration-150 hover:border-stone-400 hover:text-stone-950 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:text-stone-100"
            >
              {copy.retry}
            </button>
          </div>
        )}

        {status === 'ready' && (
          <>
            <div className="divide-y divide-stone-200/70 dark:divide-stone-800/80">
              {comments.length === 0 ? (
                <p className="px-5 py-6 text-sm text-stone-600 dark:text-stone-400">
                  {copy.empty}
                </p>
              ) : comments.map(comment => renderCommentArticle(comment, true))}
            </div>

            {hasMore && (
              <div className="border-t border-stone-200/70 px-5 py-4 dark:border-stone-800/80">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleLoadMore}
                  className="text-sm font-medium text-stone-600 transition-colors duration-150 hover:text-stone-950 disabled:cursor-not-allowed disabled:text-stone-400 dark:text-stone-400 dark:hover:text-stone-100 dark:disabled:text-stone-700"
                >
                  {copy.loadMore}
                </button>
              </div>
            )}

            {/* Composer: collapsed by default, expands on click or reply */}
            <div className="border-t border-stone-200/70 dark:border-stone-800/80">
              {!composing ? (
                <div className="flex items-center gap-3 px-5 py-4">
                  {session ? (
                    <>
                      {session.user.avatar_url ? (
                        <img
                          src={session.user.avatar_url}
                          alt=""
                          className="h-7 w-7 shrink-0 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900"
                        />
                      ) : (
                        <div className="h-7 w-7 shrink-0 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900" />
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setComposing(true)
                          if (typeof window !== 'undefined') {
                            window.requestAnimationFrame(() => composerRef.current?.focus())
                          }
                        }}
                        className="min-w-0 flex-1 truncate rounded-md border border-stone-200 bg-white px-3 py-2 text-left text-sm text-stone-400 transition-colors duration-150 hover:border-stone-300 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-600 dark:hover:border-stone-700"
                      >
                        {copy.textareaPlaceholder}
                      </button>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="shrink-0 text-xs text-stone-400 transition-colors duration-150 hover:text-stone-700 dark:text-stone-600 dark:hover:text-stone-300"
                      >
                        {copy.signOut}
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="h-7 w-7 shrink-0 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900" />
                      <span className="min-w-0 flex-1 truncate text-sm text-stone-400 dark:text-stone-600">
                        {copy.textareaDisabledPlaceholder}
                      </span>
                      <a
                        href={signInUrl}
                        className="shrink-0 text-xs font-medium text-stone-500 transition-colors duration-150 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-200"
                      >
                        {copy.signIn}
                      </a>
                    </>
                  )}
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-5">
                  {session && (
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex min-w-0 items-center gap-2">
                        {session.user.avatar_url ? (
                          <img
                            src={session.user.avatar_url}
                            alt=""
                            className="h-6 w-6 shrink-0 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900"
                          />
                        ) : (
                          <div className="h-6 w-6 shrink-0 rounded-full border border-stone-200 bg-stone-100 dark:border-stone-800 dark:bg-stone-900" />
                        )}
                        <span className="truncate text-xs text-stone-500 dark:text-stone-500">
                          {displayName(session.user)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="shrink-0 text-xs text-stone-400 transition-colors duration-150 hover:text-stone-700 dark:text-stone-600 dark:hover:text-stone-300"
                      >
                        {copy.signOut}
                      </button>
                    </div>
                  )}
                  {isReplying && (
                    <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-950/45 dark:text-stone-400">
                      <span className="min-w-0 truncate">
                        正在回复 {replyTarget ? `@${displayName(replyTarget.author)}` : `#${replyingTo}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="shrink-0 text-xs font-medium text-stone-500 transition-colors hover:text-stone-950 dark:text-stone-500 dark:hover:text-stone-100"
                      >
                        {copy.cancelReply}
                      </button>
                    </div>
                  )}
                  <label htmlFor="comment-draft" className="sr-only">
                    {isReplying ? copy.replyPlaceholder : copy.textareaPlaceholder}
                  </label>
                  <div className="relative">
                    <textarea
                      ref={composerRef}
                      id="comment-draft"
                      value={draft}
                      disabled={!session || busy}
                      onChange={handleComposerChange}
                      onKeyDown={handleComposerKeyDown}
                      onBlur={() => { // delay to allow click on suggestion
                        window.setTimeout(() => setMentionQuery(null), 150)
                      }}
                      placeholder={isReplying ? copy.replyPlaceholder : copy.textareaPlaceholder}
                      className="block min-h-28 w-full resize-y rounded-md border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-800 outline-none transition-colors placeholder:text-stone-400 focus:border-stone-400 disabled:cursor-not-allowed disabled:bg-stone-100 disabled:text-stone-400 dark:border-stone-800 dark:bg-stone-950/40 dark:text-stone-200 dark:placeholder:text-stone-600 dark:focus:border-stone-600 dark:disabled:bg-stone-900/60 dark:disabled:text-stone-700"
                    />
                    {mentionQuery && mentionSuggestions.length > 0 && (
                      <div className="absolute bottom-full left-3 z-20 mb-1 min-w-40 overflow-hidden rounded-md border border-stone-200 bg-white py-1 shadow-md dark:border-stone-800 dark:bg-stone-950">
                        {mentionSuggestions.map((login, i) => (
                          <button
                            key={login}
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault()
                              insertMention(login)
                            }}
                            className={cx(
                              'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                              i === mentionIndex
                                ? 'bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100'
                                : 'text-stone-600 dark:text-stone-400'
                            )}
                          >
                            <span className="text-stone-400">@</span>
                            <span className="truncate font-medium">{login}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    {error ? (
                      <p className="text-sm text-stone-500 dark:text-stone-500">
                        {error}
                      </p>
                    ) : <span />}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setComposing(false)
                          setDraft('')
                          setReplyingTo(null)
                          setError('')
                        }}
                        className="text-sm text-stone-500 transition-colors duration-150 hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-200"
                      >
                        {copy.cancelReply}
                      </button>
                      <button
                        type="submit"
                        disabled={!canSubmit}
                        className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors duration-150 hover:border-stone-400 hover:text-stone-950 disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-400 dark:border-stone-700 dark:text-stone-300 dark:hover:border-stone-500 dark:hover:text-stone-100 dark:disabled:border-stone-800 dark:disabled:text-stone-700"
                      >
                        {busy ? copy.submitting : isReplying ? copy.submitReply : copy.submit}
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default CommentBox
