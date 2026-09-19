'use client'

import { useDeferredValue, useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import BlogPost from '@/components/BlogPost'
import Tags from '@/components/Tags'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import { MIN_SEARCH_QUERY_LENGTH } from '@/lib/search/constants'
import type { Locale } from '@/lib/locale'

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
  copy: Locale['SEARCH']
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
  copy,
  children
}: SearchClientProps) {
  const searchInputId = useId()
  const searchHintId = useId()
  const searchStatusId = useId()
  const [searchValue, setSearchValue] = useState('')
  const deferredSearchValue = useDeferredValue(searchValue)
  const [displayTags, setDisplayTags] = useState<Record<string, number>>(tags || {})
  const [remotePosts, setRemotePosts] = useState<PostData[]>([])
  const [isSearching, setIsSearching] = useState(false)
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
    const timer = window.setTimeout(async () => {
      setIsSearching(true)
      setSearchError('')
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
      } catch (error: unknown) {
        if (controller.signal.aborted) return
        setRemotePosts([])
        setSearchError(error instanceof Error ? error.message : 'Search failed')
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
  }, [searchValue, shouldUseNotionSearch, currentTag])

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
    ? copy.HINT_SHORT.replace('{n}', String(MIN_SEARCH_QUERY_LENGTH))
    : copy.HINT
  const searchLabel = currentTag
    ? copy.LABEL_TAG.replace('{tag}', currentTag)
    : copy.LABEL
  const statusMessage = isSearching
    ? copy.SEARCHING
    : searchError
      ? `${copy.FAILED}: ${searchError}`
      : showNotionSearchHint
        ? notionSearchHint
        : showEmptyState
          ? copy.EMPTY
          : ''
  const describedBy = [
    showNotionSearchHint ? searchHintId : '',
    statusMessage ? searchStatusId : ''
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <>
      <div>
        <label htmlFor={searchInputId} className="sr-only">
          {searchLabel}
        </label>
        <input
          id={searchInputId}
          type="text"
          value={searchValue}
          aria-describedby={describedBy || undefined}
          placeholder={
            currentTag
              ? copy.PLACEHOLDER_TAG.replace('{tag}', currentTag)
              : copy.PLACEHOLDER
          }
          className="block w-full appearance-none rounded-none border-0 border-b border-stone-200 bg-transparent px-0 py-2 text-stone-900 shadow-none placeholder:text-stone-400 outline-none transition-colors duration-150 ease-out focus:border-stone-800 dark:border-stone-700 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-stone-300"
          onChange={e => setSearchValue(e.target.value)}
        />
      </div>
      {currentTag && (
        <p className="mt-3 text-sm text-stone-400 dark:text-stone-500">
          <Link
            href="/search"
            prefetch={false}
            title={copy.CLEAR_TAG}
            className="transition-colors duration-150 ease-out hover:text-stone-800 dark:hover:text-stone-200"
          >
            {copy.TAGS}
          </Link>
          <span aria-hidden="true">&nbsp;/&nbsp;</span>
          <span aria-current="page" className="text-stone-900 dark:text-stone-100">{currentTag}</span>
        </p>
      )}
      <div className="article-container my-8">
        {statusMessage && (
          <p id={searchStatusId} className="sr-only" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </p>
        )}
        {showNotionSearchHint && (
          <p id={searchHintId} className="text-stone-500 dark:text-stone-400">{notionSearchHint}</p>
        )}
        {isSearching && (
          <p className="text-stone-500 dark:text-stone-400" role="status">{copy.SEARCHING}</p>
        )}
        {!isSearching && !!searchError && (
          <p className="text-stone-600 dark:text-stone-300 font-medium" role="alert">{searchError}</p>
        )}
        {showEmptyState && (
          <p className="text-stone-500 dark:text-stone-400" role="status">{copy.EMPTY}</p>
        )}
        {showInitialResults && children}
        {filteredBlogPosts.slice(0, 20).map(post => (
          <BlogPost key={post.id} post={post} blogPath={blogPath} lang={lang} timezone={timezone} />
        ))}
      </div>
      {tagsSlot || (
        <Tags
          tags={displayTags}
          currentTag={currentTag}
        />
      )}
    </>
  )
}
