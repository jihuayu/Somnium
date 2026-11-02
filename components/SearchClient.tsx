'use client'

import { useDeferredValue, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import BlogPost from '@/components/BlogPost'
import Tags from '@/components/Tags'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import { MIN_SEARCH_QUERY_LENGTH } from '@/lib/search/constants'

interface SearchClientProps {
  tags: Record<string, number>
  posts: PostData[]
  currentTag?: string
  useNotionSearch?: boolean
  loadTagsRemotely?: boolean
  blogPath: string
  lang: string
  timezone?: string
  tagsSlot?: ReactNode
  initialResultsCount?: number
  children?: ReactNode
}

function hasMinQueryLength(value: string): boolean {
  return Array.from(value).length >= MIN_SEARCH_QUERY_LENGTH
}

export default function SearchClient({
  tags,
  posts,
  currentTag,
  useNotionSearch = false,
  loadTagsRemotely = false,
  blogPath,
  lang,
  timezone,
  tagsSlot,
  initialResultsCount = 0,
  children
}: SearchClientProps) {
  const searchInputId = useId()
  const searchStatusId = useId()
  const [searchValue, setSearchValue] = useState('')
  const deferredSearchValue = useDeferredValue(searchValue)
  const [displayTags, setDisplayTags] = useState<Record<string, number>>(tags || {})
  const [remotePosts, setRemotePosts] = useState<PostData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [searchError, setSearchError] = useState('')
  const shouldUseNotionSearch = useNotionSearch
  const searchablePosts = useMemo(
    () =>
      posts.map(post => {
        const tagContent = post.tags ? post.tags.join(' ') : ''
        return {
          post,
          searchContent: (post.title + post.summary + tagContent).toLowerCase()
        }
      }),
    [posts]
  )

  useEffect(() => {
    setDisplayTags(tags || {})
  }, [tags])

  useEffect(() => {
    if (!loadTagsRemotely) return undefined
    if (Object.keys(tags || {}).length > 0) return undefined

    const controller = new AbortController()
    fetch('/api/tags', {
      method: 'GET',
      signal: controller.signal
    })
      .then(async response => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Failed to load tags')
        }
        const nextTags = payload?.tags
        if (nextTags && typeof nextTags === 'object' && !Array.isArray(nextTags)) {
          setDisplayTags(nextTags)
        }
      })
      .catch(() => {
        if (controller.signal.aborted) return
      })

    return () => controller.abort()
  }, [loadTagsRemotely, tags])

  useEffect(() => {
    if (!shouldUseNotionSearch) return undefined

    const keyword = searchValue.trim()
    if (!keyword || !hasMinQueryLength(keyword)) {
      setRemotePosts([])
      setIsSearching(false)
      setSearchError('')
      return undefined
    }

    const controller = new AbortController()
    setIsSearching(true)
    setSearchError('')
    setRemotePosts([])
    const timer = window.setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({
          q: keyword,
          limit: '20'
        })
        if (currentTag) {
          searchParams.set('tag', currentTag)
        }
        const response = await fetch(`/api/search?${searchParams.toString()}`, {
          method: 'GET',
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(payload?.error || 'Search request failed')
        }
        setRemotePosts(Array.isArray(payload?.posts) ? payload.posts : [])
      } catch {
        if (controller.signal.aborted) return
        setRemotePosts([])
        setSearchError('搜索暂时不可用，请重试。')
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false)
        }
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [searchValue, shouldUseNotionSearch, currentTag, attempt])

  const trimmedQuery = deferredSearchValue.trim()
  const isQueryEmpty = !trimmedQuery
  const isQueryTooShort = !isQueryEmpty && !hasMinQueryLength(trimmedQuery)
  const shouldShowRemoteResults = shouldUseNotionSearch && !isQueryEmpty && !isQueryTooShort
  const hasInitialResults = initialResultsCount > 0
  const localFilteredPosts = useMemo(() => {
    if (!trimmedQuery) return posts
    const query = trimmedQuery.toLowerCase()
    return searchablePosts
      .filter(item => item.searchContent.includes(query))
      .map(item => item.post)
  }, [trimmedQuery, posts, searchablePosts])

  const filteredBlogPosts = shouldUseNotionSearch
    ? (shouldShowRemoteResults ? remotePosts : [])
    : localFilteredPosts

  const showInitialResults = shouldUseNotionSearch && !shouldShowRemoteResults && hasInitialResults
  const showNotionSearchHint = shouldUseNotionSearch && !showInitialResults && (isQueryEmpty || isQueryTooShort) && !isSearching && !searchError
  const showEmptyState = !showNotionSearchHint && !showInitialResults && !isSearching && !searchError && !filteredBlogPosts.length
  const notionSearchHint = isQueryTooShort
    ? `请输入至少 ${MIN_SEARCH_QUERY_LENGTH} 个字符。`
    : '输入关键词，查找文章。'
  const searchLabel = currentTag ? `在「${currentTag}」中搜索文章` : '搜索文章'
  const statusMessage = isSearching ? '正在搜索…' : searchError ||
    (showNotionSearchHint ? notionSearchHint : showEmptyState ? '没有找到相关文章，试试其他关键词。' : '')

  return (
    <>
      <div className="relative">
        <label htmlFor={searchInputId} className="sr-only">
          {searchLabel}
        </label>
        <input
          id={searchInputId}
          type="text"
          value={searchValue}
          aria-describedby={searchStatusId}
          placeholder="搜索文章"
          className="search-input"
          onChange={e => setSearchValue(e.target.value)}
        />
        {searchValue && (
          <button type="button" className="search-clear" onClick={() => {
            setSearchValue('')
            document.getElementById(searchInputId)?.focus()
          }}>清空</button>
        )}
      </div>
      {tagsSlot || (
        <Tags
          tags={displayTags}
          currentTag={currentTag}
        />
      )}
      <div className="article-container my-8">
        <p id={searchStatusId} role="status" className="search-status">{statusMessage}</p>
        {searchError && <button type="button" className="min-h-11 underline" onClick={() => setAttempt(n => n + 1)}>重试</button>}
        {showInitialResults && children}
        {filteredBlogPosts.slice(0, 20).map(post => (
          <BlogPost key={post.id} post={post} blogPath={blogPath} lang={lang} timezone={timezone} />
        ))}
      </div>
    </>
  )
}
