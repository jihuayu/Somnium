'use client'

import cn from 'classnames'
import type { LinkPreviewData } from '@/lib/link-preview/types'
import { normalizePreviewUrl } from '@/lib/link-preview/normalize'
import { useEffect, useState } from 'react'

interface LinkPreviewCardProps {
  url: string
  className?: string
  initialData?: LinkPreviewData
}

const previewCache = new Map<string, LinkPreviewData>()

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
      icon: iconSource
    }
  } catch {
    return { url, hostname: '', title: url, description: '', image: '', icon: '' }
  }
}

function mergePreview(
  normalizedUrl: string,
  fallback: LinkPreviewData,
  data: Partial<LinkPreviewData> | null | undefined
): LinkPreviewData {
  return {
    ...fallback,
    ...(data || {}),
    url: data?.url || normalizedUrl
  }
}

function resolvePreviewData(
  normalizedUrl: string,
  fallback: LinkPreviewData,
  initialData?: LinkPreviewData
): LinkPreviewData {
  if (!normalizedUrl) return fallback
  return mergePreview(normalizedUrl, fallback, initialData || null)
}

export function LinkPreviewCardFallback({ className }: { className?: string }) {
  return (
    <div
      data-link-preview-card="true"
      data-has-image="true"
      className={cn('link-preview-card block my-4 h-[110px] rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-transparent', className)}
    >
      <div className="link-preview-card-inner flex h-full items-stretch">
        <div className="link-preview-card-main min-w-0 basis-[65%] shrink-0 flex flex-col px-3 py-2">
          <div className="h-5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="mt-2 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="mt-1.5 h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="mt-auto pt-1.5 h-4 w-2/5 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        </div>
        <div className="link-preview-card-media basis-[35%] shrink-0 h-full">
          <div className="h-full w-full bg-zinc-200/80 dark:bg-zinc-700/70 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default function LinkPreviewCard({ url, className, initialData }: LinkPreviewCardProps) {
  const normalizedUrl = normalizePreviewUrl(url) || ''
  const fallback = buildFallback(normalizedUrl || url)
  const fallbackUrl = fallback.url
  const fallbackHostname = fallback.hostname
  const fallbackTitle = fallback.title
  const fallbackDescription = fallback.description
  const fallbackImage = fallback.image
  const fallbackIcon = fallback.icon
  const initialTitle = `${initialData?.title || ''}`.trim()
  const initialHasMedia = !!(initialData?.image || initialData?.icon || initialData?.description)
  const [remotePreviewState, setRemotePreviewState] = useState<{ url: string, data: LinkPreviewData | null }>({
    url: '',
    data: null
  })
  const cachedPreview = normalizedUrl ? previewCache.get(normalizedUrl) || null : null
  const remotePreview = remotePreviewState.url === normalizedUrl ? remotePreviewState.data : null
  const preview = resolvePreviewData(
    normalizedUrl,
    {
      url: fallbackUrl,
      hostname: fallbackHostname,
      title: fallbackTitle,
      description: fallbackDescription,
      image: fallbackImage,
      icon: fallbackIcon
    },
    (remotePreview || cachedPreview || initialData || null) as LinkPreviewData | undefined
  )

  useEffect(() => {
    if (!normalizedUrl) return
    if (initialHasMedia && initialTitle && initialTitle !== fallbackTitle) return

    const cached = previewCache.get(normalizedUrl)
    if (cached) return

    const controller = new AbortController()
    fetch(`/api/link-preview?url=${encodeURIComponent(normalizedUrl)}`, {
      method: 'GET',
      signal: controller.signal
    })
      .then(async response => {
        if (!response.ok) return null
        return response.json().catch(() => null)
      })
      .then(payload => {
        if (!payload || typeof payload !== 'object') return
        const next = mergePreview(normalizedUrl, {
          url: fallbackUrl,
          hostname: fallbackHostname,
          title: fallbackTitle,
          description: fallbackDescription,
          image: fallbackImage,
          icon: fallbackIcon
        }, payload as Partial<LinkPreviewData>)
        previewCache.set(normalizedUrl, next)
        setRemotePreviewState({ url: normalizedUrl, data: next })
      })
      .catch(() => {
        if (controller.signal.aborted) return
      })

    return () => controller.abort()
  }, [
    fallbackDescription,
    fallbackHostname,
    fallbackIcon,
    fallbackImage,
    fallbackTitle,
    fallbackUrl,
    initialHasMedia,
    initialTitle,
    normalizedUrl
  ])

  const displayUrl = preview.url || normalizedUrl
  const generatedImageUrl = displayUrl ? `${preview.image || ''}`.trim() : ''

  if (!displayUrl) return null

  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-link-preview-card="true"
      data-has-image={generatedImageUrl ? 'true' : 'false'}
      className={cn(
        'link-preview-card block my-4 h-[110px] rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="link-preview-card-inner flex h-full items-stretch">
        <div className={cn(
          'link-preview-card-main min-w-0 flex flex-col px-3 py-2',
          generatedImageUrl ? 'basis-[65%] shrink-0' : 'flex-1'
        )}>
          <p className="text-base text-zinc-900 dark:text-zinc-100 font-medium truncate">
            {preview.title || preview.hostname || displayUrl}
          </p>
          {preview.description && (
            <p
              className="mt-0.5 text-zinc-600 dark:text-zinc-300 text-sm leading-5 overflow-hidden"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {preview.description}
            </p>
          )}
          <div className="mt-auto pt-1.5 flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-xs">
            {preview.icon ? (
              <span className="relative h-4 w-4 rounded-sm flex-none overflow-hidden bg-transparent">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.icon}
                  alt=""
                  className="h-4 w-4 rounded-sm bg-transparent object-contain"
                  loading="lazy"
                />
              </span>
            ) : (
              <span className="h-4 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-700 flex-none" />
            )}
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
        {generatedImageUrl && (
          <div className="link-preview-card-media basis-[35%] shrink-0 h-full">
            <div className="relative h-full w-full overflow-hidden bg-zinc-200/80 dark:bg-zinc-700/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt={preview.title || preview.hostname || 'Link preview'}
                className="link-preview-cover pointer-events-none h-full w-full object-cover transition-opacity duration-200"
                style={{ filter: 'none' }}
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>
    </a>
  )
}
