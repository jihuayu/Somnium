'use client'

import { useEffect, useState } from 'react'
import BlogPost from '@/components/BlogPost'
import Container from '@/components/Container'
import Tags from '@/components/Tags'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import { MIN_SEARCH_QUERY_LENGTH } from '@/lib/search/constants'

interface SearchLayoutProps {
  tags: Record<string, number>
  posts: PostData[]
  currentTag?: string
  useNotionSearch?: boolean
  loadTagsRemotely?: boolean
}

function hasMinQueryLength(value: string): boolean {
  return Array.from(value).length >= MIN_SEARCH_QUERY_LENGTH
}

const SearchLayout = ({
  tags,
  posts,
  currentTag,
  useNotionSearch = false,
  loadTagsRemotely = false
}: SearchLayoutProps) => {
  const [searchValue, setSearchValue] = useState('')
  const [displayTags, setDisplayTags] = useState<Record<string, number>>(tags || {})
  const [remotePosts, setRemotePosts] = useState<PostData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const shouldUseNotionSearch = useNotionSearch

  useEffect(() => {
    setDisplayTags(tags || {})
  }, [tags])

  useEffect(() => {
    if (!loadTagsRemotely) return
    if (Object.keys(tags || {}).length > 0) return

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
    if (!shouldUseNotionSearch) return

    const keyword = searchValue.trim()
    if (!keyword || !hasMinQueryLength(keyword)) {
      setRemotePosts([])
      setIsSearching(false)
      setSearchError('')
      return
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
      } catch (error: any) {
        if (controller.signal.aborted) return
        setRemotePosts([])
        setSearchError(error?.message || 'Search failed')
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

  const trimmedQuery = searchValue.trim()
  const isQueryEmpty = !trimmedQuery
  const isQueryTooShort = !isQueryEmpty && !hasMinQueryLength(trimmedQuery)
  const filteredBlogPosts = shouldUseNotionSearch
    ? (isQueryEmpty || isQueryTooShort ? posts : remotePosts)
    : posts.filter(post => {
      const tagContent = post.tags ? post.tags.join(' ') : ''
      const searchContent = post.title + post.summary + tagContent
      return searchContent.toLowerCase().includes(searchValue.toLowerCase())
    })

  const showNotionSearchHint = shouldUseNotionSearch && !posts.length && (isQueryEmpty || isQueryTooShort) && !isSearching && !searchError
  const showEmptyState = !showNotionSearchHint && !isSearching && !searchError && !filteredBlogPosts.length
  const notionSearchHint = isQueryTooShort
    ? `Type at least ${MIN_SEARCH_QUERY_LENGTH} characters to search posts in Notion.`
    : 'Type keywords to search posts in Notion.'

  return (
    <Container>
      <div className="relative">
        <input
          type="text"
          placeholder={
            currentTag ? `Search in #${currentTag}` : 'Search Articles'
          }
          className="block w-full border px-4 py-2 border-black bg-white text-black dark:bg-night dark:border-white dark:text-white"
          onChange={e => setSearchValue(e.target.value)}
        />
        <svg
          className="absolute right-3 top-3 h-5 w-5 text-black dark:text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          ></path>
        </svg>
      </div>
      <Tags
        tags={displayTags}
        currentTag={currentTag}
      />
      <div className="article-container my-8">
        {showNotionSearchHint && (
          <p className="text-gray-500 dark:text-gray-300">{notionSearchHint}</p>
        )}
        {isSearching && (
          <p className="text-gray-500 dark:text-gray-300">Searching...</p>
        )}
        {!isSearching && !!searchError && (
          <p className="text-red-500 dark:text-red-400">{searchError}</p>
        )}
        {showEmptyState && (
          <p className="text-gray-500 dark:text-gray-300">No posts found.</p>
        )}
        {filteredBlogPosts.slice(0, 20).map(post => (
          <BlogPost key={post.id} post={post} />
        ))}
      </div>
    </Container>
  )
}

export default SearchLayout
