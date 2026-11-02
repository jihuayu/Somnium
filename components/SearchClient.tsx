'use client'

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
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
  initialResultsCount?: number
  children?: ReactNode
}

interface SearchResult {
  keyword: string
  tag: string
  status: 'loading' | 'ready' | 'error'
  posts: PostData[]
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
  initialResultsCount = 0,
  children
}: SearchClientProps) {
  const searchInputId = useId()
  const searchStatusId = useId()
  const searchTitleId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [isReady, setIsReady] = useState(false)
  const [searchValue, setSearchValue] = useState('')
  const [displayTags, setDisplayTags] = useState<Record<string, number>>(tags || {})
  const [result, setResult] = useState<SearchResult | null>(null)
  const [attempt, setAttempt] = useState(0)
  const shouldUseNotionSearch = useNotionSearch
  const keyword = searchValue.trim()
  const tag = currentTag || ''
  const isQueryValid = !!keyword && hasMinQueryLength(keyword)
  const searchablePosts = useMemo(
    () =>
      posts.map(post => {
        const tagContent = post.tags ? post.tags.join(' ') : ''
        return {
          post,
          searchContent: [post.title, post.summary, tagContent].join(' ').toLowerCase()
        }
      }),
    [posts]
  )

  useEffect(() => {
    const restoreQuery = () => setSearchValue(new URL(window.location.href).searchParams.get('q') || '')
    restoreQuery()
    setIsReady(true)
    window.addEventListener('popstate', restoreQuery)
    return () => window.removeEventListener('popstate', restoreQuery)
  }, [])

  function updateSearchValue(value: string) {
    setSearchValue(value)
    const url = new URL(window.location.href)
    if (value) url.searchParams.set('q', value)
    else url.searchParams.delete('q')
    window.history.replaceState(window.history.state, '', url)
  }

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

    if (!isQueryValid) {
      setResult(null)
      return undefined
    }

    const controller = new AbortController()
    setResult({ keyword, tag, status: 'loading', posts: [] })
    const timer = window.setTimeout(async () => {
      try {
        const searchParams = new URLSearchParams({
          q: keyword,
          limit: '20'
        })
        if (tag) {
          searchParams.set('tag', tag)
        }
        const response = await fetch(`/api/search?${searchParams.toString()}`, {
          method: 'GET',
          signal: controller.signal
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !Array.isArray(payload?.posts)) {
          throw new Error('Search request failed')
        }
        if (!controller.signal.aborted) {
          setResult({ keyword, tag, status: 'ready', posts: payload.posts })
        }
      } catch {
        if (controller.signal.aborted) return
        setResult({ keyword, tag, status: 'error', posts: [] })
      }
    }, 300)

    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [keyword, isQueryValid, shouldUseNotionSearch, tag, attempt])

  const currentResult = result?.keyword === keyword && result.tag === tag ? result : null
  const isSearching = shouldUseNotionSearch && isQueryValid &&
    (!currentResult || currentResult.status === 'loading')
  const hasSearchError = shouldUseNotionSearch && isQueryValid && currentResult?.status === 'error'
  const localFilteredPosts = useMemo(() => {
    if (!keyword) return posts
    const query = keyword.toLowerCase()
    return searchablePosts
      .filter(item => item.searchContent.includes(query))
      .map(item => item.post)
  }, [keyword, posts, searchablePosts])

  const filteredBlogPosts = shouldUseNotionSearch
    ? (isQueryValid && currentResult?.status === 'ready' ? currentResult.posts : [])
    : localFilteredPosts

  const showInitialResults = shouldUseNotionSearch && !isQueryValid && initialResultsCount > 0
  const resultCount = showInitialResults ? initialResultsCount : filteredBlogPosts.length
  const searchLabel = currentTag ? `在「${currentTag}」中搜索文章` : '搜索文章'
  const statusMessage = hasSearchError
    ? '搜索暂时不可用，请重试。'
    : isSearching
      ? '正在搜索…'
      : shouldUseNotionSearch && keyword && !isQueryValid
        ? `请输入至少 ${MIN_SEARCH_QUERY_LENGTH} 个字符。`
        : !keyword && !showInitialResults && shouldUseNotionSearch
          ? '输入关键词，查找文章。'
          : resultCount
            ? `共 ${resultCount} 篇文章。`
            : '没有找到相关文章，试试其他关键词。'

  return (
    <section className="search-page" aria-labelledby={searchTitleId}>
      <h1 id={searchTitleId} className="page-title">{currentTag || '搜索'}</h1>
      <form role="search" className="search-form" aria-busy={!isReady} onSubmit={event => {
        event.preventDefault()
        setAttempt(current => current + 1)
      }}>
        <label htmlFor={searchInputId} className="sr-only">
          {searchLabel}
        </label>
        <div className="search-field">
          <input
            ref={inputRef}
            id={searchInputId}
            type="search"
            disabled={!isReady}
            value={searchValue}
            aria-describedby={searchStatusId}
            placeholder="搜索文章"
            className="search-input"
            autoComplete="off"
            onChange={event => updateSearchValue(event.target.value)}
          />
          {searchValue && (
            <button type="button" className="search-clear" onClick={() => {
              updateSearchValue('')
              inputRef.current?.focus()
            }}>清空</button>
          )}
        </div>
        <button type="submit" className="search-submit" disabled={!isReady}>搜索</button>
      </form>
      <div className="search-filters">
        <Tags
          tags={displayTags}
          currentTag={currentTag}
          query={searchValue}
        />
      </div>
      <div className="search-feedback">
        <p id={searchStatusId} role="status" className="search-status">{statusMessage}</p>
        {hasSearchError && (
          <button type="button" className="search-retry" onClick={() => setAttempt(current => current + 1)}>重试</button>
        )}
      </div>
      <section className="search-results" aria-label="文章列表" aria-busy={isSearching}>
        {showInitialResults && children}
        {filteredBlogPosts.slice(0, 20).map(post => (
          <BlogPost key={post.id} post={post} blogPath={blogPath} lang={lang} timezone={timezone} />
        ))}
      </section>
    </section>
  )
}
