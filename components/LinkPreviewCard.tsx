'use client'

import { useEffect, useMemo, useState } from 'react'
import cn from 'classnames'
import type { LinkPreviewData } from '@/lib/link-preview/types'

function buildFallback(url: string): LinkPreviewData {
  if (!url) {
    return { url: '', hostname: '', title: '', description: '', image: '', icon: '' }
  }

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const iconSource = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    return {
      url: parsed.toString(),
      hostname,
      title: hostname,
      description: '',
      image: '',
      icon: `/api/link-preview/image?url=${encodeURIComponent(iconSource)}`
    }
  } catch {
    return { url, hostname: '', title: url, description: '', image: '', icon: '' }
  }
}

function buildLinkPreviewOgImageUrl(preview: LinkPreviewData, fallbackUrl: string): string {
  if (!preview.image) return ''
  const params = new URLSearchParams()
  params.set('image', preview.image)
  params.set('url', preview.url || fallbackUrl)
  return `/api/link-preview/og?${params.toString()}`
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
  const seeded = useMemo(() => {
    if (!normalizedUrl) return null
    if (initialData) {
      return {
        ...fallback,
        ...initialData,
        url: initialData.url || normalizedUrl
      }
    }
    return null
  }, [normalizedUrl, initialData, fallback])

  const [fetchedState, setFetchedState] = useState<{ url: string; data: LinkPreviewData | null }>(() => ({
    url: normalizedUrl,
    data: null
  }))

  useEffect(() => {
    if (!normalizedUrl) return
    if (seeded) return
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
        setFetchedState({ url: normalizedUrl, data: next })
      })
      .catch(() => {
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
  const generatedImageUrl = displayUrl ? buildLinkPreviewOgImageUrl(preview, displayUrl) : ''
  const [loadedCoverSrc, setLoadedCoverSrc] = useState('')
  const [failedCoverSrc, setFailedCoverSrc] = useState('')
  const [loadedIconSrc, setLoadedIconSrc] = useState('')
  const isCoverLoaded = !!generatedImageUrl && loadedCoverSrc === generatedImageUrl
  const isCoverError = !!generatedImageUrl && failedCoverSrc === generatedImageUrl
  const isIconLoaded = !!preview.icon && loadedIconSrc === preview.icon

  if (!displayUrl) return null

  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block my-4 rounded-md border border-blue-400/70 hover:border-blue-500 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="flex items-stretch">
        <div className="min-w-0 flex flex-1 flex-col px-4 py-3">
          <p className="text-base text-zinc-900 dark:text-zinc-100 font-medium truncate">
            {preview.title || preview.hostname || displayUrl}
          </p>
          {preview.description && (
            <p
              className="mt-2 pl-[3ch] text-zinc-600 dark:text-zinc-300 text-[13px] italic leading-5 overflow-hidden"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {preview.description}
            </p>
          )}
          <div className="mt-auto pt-2 flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-xs">
            {preview.icon ? (
              <span className="relative h-4 w-4 rounded-sm flex-none overflow-hidden">
                <span
                  className={cn(
                    'absolute inset-0 bg-zinc-300 dark:bg-zinc-700 transition-opacity duration-200',
                    isIconLoaded ? 'opacity-0' : 'opacity-100'
                  )}
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.icon}
                  alt=""
                  className={cn(
                    'h-4 w-4 rounded-sm transition-opacity duration-200',
                    isIconLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                  loading="lazy"
                  onLoad={() => setLoadedIconSrc(preview.icon)}
                  onError={() => setLoadedIconSrc('')}
                />
              </span>
            ) : (
              <span className="h-4 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-700 flex-none" />
            )}
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
        {generatedImageUrl && (
          <div className="hidden sm:flex shrink-0 items-center justify-center px-2">
            <div className="relative h-28 w-40 md:h-36 md:w-52 lg:h-40 lg:w-56 overflow-hidden rounded-sm">
              <span
                className={cn(
                  'absolute inset-0 bg-zinc-200/80 dark:bg-zinc-700/70 transition-opacity duration-200',
                  isCoverLoaded ? 'opacity-0' : 'opacity-100',
                  !isCoverError && 'animate-pulse'
                )}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt={preview.title || preview.hostname || 'Link preview'}
                className={cn(
                  'h-full w-full rounded-sm object-cover transition-opacity duration-200',
                  isCoverLoaded ? 'opacity-100' : 'opacity-0'
                )}
                style={{ filter: 'none' }}
                loading="lazy"
                onLoad={() => {
                  setLoadedCoverSrc(generatedImageUrl)
                  setFailedCoverSrc('')
                }}
                onError={() => {
                  setFailedCoverSrc(generatedImageUrl)
                }}
              />
            </div>
          </div>
        )}
      </div>
    </a>
  )
}
