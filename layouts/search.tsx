'use client'

import { useEffect, useState } from 'react'
import BlogPost from '@/components/BlogPost'
import Container from '@/components/Container'
import Tags from '@/components/Tags'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface SearchLayoutProps {
  tags: Record<string, number>
  posts: PostData[]
  currentTag?: string
  useNotionSearch?: boolean
}

const SearchLayout = ({ tags, posts, currentTag, useNotionSearch = false }: SearchLayoutProps) => {
  const [searchValue, setSearchValue] = useState('')
  const [remotePosts, setRemotePosts] = useState<PostData[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState('')
  const shouldUseNotionSearch = useNotionSearch && !currentTag

  useEffect(() => {
    if (!shouldUseNotionSearch) return

    const keyword = searchValue.trim()
    if (!keyword) {
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
        const response = await fetch(`/api/search?q=${encodeURIComponent(keyword)}&limit=20`, {
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
  }, [searchValue, shouldUseNotionSearch])

  const filteredBlogPosts = shouldUseNotionSearch
    ? remotePosts
    : posts.filter(post => {
      const tagContent = post.tags ? post.tags.join(' ') : ''
      const searchContent = post.title + post.summary + tagContent
      return searchContent.toLowerCase().includes(searchValue.toLowerCase())
    })

  const isQueryEmpty = !searchValue.trim()
  const showNotionSearchHint = shouldUseNotionSearch && isQueryEmpty && !isSearching && !searchError
  const showEmptyState = !showNotionSearchHint && !isSearching && !searchError && !filteredBlogPosts.length

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
        tags={tags}
        currentTag={currentTag}
      />
      <div className="article-container my-8">
        {showNotionSearchHint && (
          <p className="text-gray-500 dark:text-gray-300">Type keywords to search posts in Notion.</p>
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
