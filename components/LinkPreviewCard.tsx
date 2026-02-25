'use client'

import { useEffect, useMemo, useState } from 'react'
import cn from 'classnames'
import type { LinkPreviewData } from '@/lib/link-preview/types'

const previewCache = new Map<string, LinkPreviewData>()

function buildFallback(url: string): LinkPreviewData {
  if (!url) {
    return { url: '', hostname: '', title: '', description: '', image: '', icon: '' }
  }

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    return {
      url: parsed.toString(),
      hostname,
      title: hostname,
      description: '',
      image: '',
      icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    }
  } catch {
    return { url, hostname: '', title: url, description: '', image: '', icon: '' }
  }
}

interface LinkPreviewCardProps {
  url: string
  className?: string
  initialData?: LinkPreviewData
}

export default function LinkPreviewCard({ url, className, initialData }: LinkPreviewCardProps) {
  const normalizedUrl = useMemo(() => {
    try { return new URL(url).toString() } catch { return '' }
  }, [url])
  const fallback = useMemo(() => buildFallback(normalizedUrl), [normalizedUrl])
  const cached = useMemo(
    () => (normalizedUrl ? previewCache.get(normalizedUrl) : null),
    [normalizedUrl]
  )
  const seeded = useMemo(() => {
    if (!normalizedUrl) return null
    if (initialData) {
      return {
        ...fallback,
        ...initialData,
        url: initialData.url || normalizedUrl
      }
    }
    return cached || null
  }, [normalizedUrl, initialData, fallback, cached])

  const [fetchedState, setFetchedState] = useState<{ url: string; data: LinkPreviewData | null }>(() => ({
    url: normalizedUrl,
    data: null
  }))

  useEffect(() => {
    if (!normalizedUrl) return
    if (seeded) {
      previewCache.set(normalizedUrl, seeded)
      return
    }
    const controller = new AbortController()
    fetch(`/api/link-preview?url=${encodeURIComponent(normalizedUrl)}`, {
      signal: controller.signal
    })
      .then(async response => {
        if (!response.ok) return fallback
        return response.json()
      })
      .then(data => {
        const next: LinkPreviewData = { ...fallback, ...(data || {}) }
        previewCache.set(normalizedUrl, next)
        setFetchedState({ url: normalizedUrl, data: next })
      })
      .catch(() => {
        previewCache.set(normalizedUrl, fallback)
        setFetchedState({ url: normalizedUrl, data: fallback })
      })
    return () => controller.abort()
  }, [normalizedUrl, seeded, fallback])

  const preview = (
    fetchedState.url === normalizedUrl && fetchedState.data
      ? fetchedState.data
      : seeded || fallback
  )
  const displayUrl = preview.url || normalizedUrl
  if (!displayUrl) return null

  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group block my-4 rounded-md border border-blue-400/70 hover:border-blue-500 transition-colors overflow-hidden bg-transparent',
        className
      )}
    >
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1 px-4 py-3">
          <p className="text-base text-zinc-900 dark:text-zinc-100 font-medium truncate">
            {preview.title || preview.hostname || displayUrl}
          </p>
          {preview.description && (
            <p className="mt-1 text-zinc-600 dark:text-zinc-300 text-sm leading-6 max-h-12 overflow-hidden">
              {preview.description}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-xs">
            {preview.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview.icon}
                alt=""
                className="h-4 w-4 rounded-sm flex-none"
                loading="lazy"
              />
            ) : (
              <span className="h-4 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-700 flex-none" />
            )}
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
        {preview.image && (
          <div className="hidden sm:flex shrink-0 items-center justify-center border-l border-zinc-200/70 dark:border-zinc-700/70 px-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview.image}
              alt={preview.title || preview.hostname || 'Link preview'}
              className="h-36 w-24 md:h-44 md:w-28 lg:h-48 lg:w-32 rounded-sm object-cover"
              loading="lazy"
            />
          </div>
        )}
      </div>
    </a>
  )
}
