'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { normalizePreviewUrl } from '@/lib/link-preview/normalize'
import { useFloatingHoverCard } from '@/components/hooks/useFloatingHoverCard'

export interface UrlMentionPreviewData {
  href: string
  title: string
  description: string
  icon: string
  image: string
  provider: string
}

interface UrlMentionProps {
  href: string
  label: string
  iconUrl?: string
  preview: UrlMentionPreviewData | null
  isGithub: boolean
}

// Hover card behavior and layout constants.
const URL_MENTION_FLOATING_CONFIG = {
  closeDelayMs: 90,
  viewportPadding: 12,
  gap: 10,
  targetWidth: 280,
  minWidth: 120,
  fallbackWidth: 280,
  fallbackHeight: 220,
  initialOffset: 12
} as const

const previewCache = new Map<string, UrlMentionPreviewData>()

function renderUrlMentionIcon(href: string, iconUrl: string, isGithub: boolean) {
  if (iconUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={iconUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
    )
  }

  if (isGithub || /^https?:\/\/(?:www\.)?github\.com\/?/i.test(href)) {
    return (
      <svg viewBox="0 0 16 16" fill="currentColor" role="presentation">
        <path d="M8 0C3.58 0 0 3.58 0 8a8.001 8.001 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.08-2.7-1.08-.36-.92-.9-1.16-.9-1.16-.73-.5.06-.49.06-.49.82.06 1.25.84 1.25.84.72 1.25 1.9.89 2.36.68.07-.53.28-.9.5-1.1-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.58.82-2.13-.08-.2-.36-1.01.08-2.1 0 0 .67-.21 2.2.81.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.55.82 1.26.82 2.13 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8.001 8.001 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" role="presentation">
      <path d="M8.75 6.25h-1.5a4 4 0 1 0 0 8h1.5" />
      <path d="M11.25 6.25h1.5a4 4 0 1 1 0 8h-1.5" />
      <path d="M7.5 10h5" />
    </svg>
  )
}

function getProviderFromHref(href: string): string {
  try {
    return new URL(href).hostname.replace(/^www\./i, '')
  } catch {
    return href
  }
}

function buildFallbackPreview(href: string, label: string, iconUrl: string): UrlMentionPreviewData {
  return {
    href,
    title: label || href,
    description: '',
    icon: iconUrl || '',
    image: '',
    provider: getProviderFromHref(href)
  }
}

function mergePreviewData(
  base: UrlMentionPreviewData,
  incoming: Partial<UrlMentionPreviewData> | null | undefined
): UrlMentionPreviewData {
  if (!incoming) return base
  return {
    href: `${incoming.href || base.href}`.trim() || base.href,
    title: `${incoming.title || base.title}`.trim() || base.title,
    description: `${incoming.description || base.description}`.trim(),
    icon: `${incoming.icon || base.icon}`.trim(),
    image: `${incoming.image || base.image}`.trim(),
    provider: `${incoming.provider || base.provider}`.trim() || base.provider
  }
}

function shouldFetchRemotePreview(preview: UrlMentionPreviewData, label: string): boolean {
  const hasRichMedia = !!(preview.image || preview.description || preview.icon)
  const hasCustomTitle = !!preview.title && preview.title !== label
  return !(hasRichMedia && hasCustomTitle)
}

export default function UrlMention({
  href,
  label,
  iconUrl = '',
  preview,
  isGithub
}: UrlMentionProps) {
  const fallbackPreview = buildFallbackPreview(href, label, iconUrl)
  const [remotePreviewState, setRemotePreviewState] = useState<{ href: string, data: UrlMentionPreviewData | null }>({
    href: '',
    data: null
  })
  const fetchedKeyRef = useRef('')
  const normalizedHref = normalizePreviewUrl(href)
  const cachedPreview = normalizedHref ? previewCache.get(normalizedHref) || null : null
  const remotePreview = remotePreviewState.href === href ? remotePreviewState.data : null
  const resolvedPreview = mergePreviewData(fallbackPreview, remotePreview || cachedPreview || preview || null)
  const {
    triggerRef,
    cardRef,
    open,
    floatingStyle,
    openCard,
    scheduleClose,
    handleBlur
  } = useFloatingHoverCard<HTMLAnchorElement, HTMLAnchorElement>({
    enabled: !!resolvedPreview,
    closeDelayMs: URL_MENTION_FLOATING_CONFIG.closeDelayMs,
    viewportPadding: URL_MENTION_FLOATING_CONFIG.viewportPadding,
    gap: URL_MENTION_FLOATING_CONFIG.gap,
    initialOffset: URL_MENTION_FLOATING_CONFIG.initialOffset,
    fallbackWidth: URL_MENTION_FLOATING_CONFIG.fallbackWidth,
    fallbackHeight: URL_MENTION_FLOATING_CONFIG.fallbackHeight,
    targetWidth: URL_MENTION_FLOATING_CONFIG.targetWidth,
    minWidth: URL_MENTION_FLOATING_CONFIG.minWidth
  })

  const fetchPreview = async () => {
    if (!normalizedHref) return
    if (fetchedKeyRef.current === normalizedHref) return
    if (!shouldFetchRemotePreview(resolvedPreview, label)) return
    fetchedKeyRef.current = normalizedHref

    const cached = previewCache.get(normalizedHref)
    if (cached) return

    try {
      const response = await fetch(`/api/link-preview?url=${encodeURIComponent(normalizedHref)}`, { method: 'GET' })
      if (!response.ok) return
      const payload = await response.json().catch(() => null)
      if (!payload || typeof payload !== 'object') return

      const next = mergePreviewData(fallbackPreview, payload as Partial<UrlMentionPreviewData>)
      previewCache.set(normalizedHref, next)
      setRemotePreviewState({ href, data: next })
    } catch {
      // Ignore network errors and keep fallback preview.
    }
  }

  const handleOpen = () => {
    openCard()
    void fetchPreview()
  }

  const floatingCard = open && resolvedPreview
    ? createPortal(
      <a
        ref={cardRef}
        href={resolvedPreview.href}
        target="_blank"
        rel="noopener noreferrer"
        className="notion-url-mention-hover-card"
        style={floatingStyle}
        onMouseEnter={handleOpen}
        onMouseLeave={scheduleClose}
        onFocus={handleOpen}
        onBlur={handleBlur}
      >
        {resolvedPreview.image && (
          <span className="notion-url-mention-hover-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedPreview.image} alt={resolvedPreview.title} loading="lazy" />
          </span>
        )}

        <span className="notion-url-mention-hover-body">
          <span className="notion-url-mention-hover-title">{resolvedPreview.title || label}</span>
          {resolvedPreview.description && (
            <span className="notion-url-mention-hover-description">{resolvedPreview.description}</span>
          )}
          <span className="notion-url-mention-hover-footer">
            <span className="notion-url-mention-hover-provider-icon" aria-hidden="true">
              {renderUrlMentionIcon(href, resolvedPreview.icon || iconUrl, isGithub)}
            </span>
            <span className="notion-url-mention-hover-provider">{resolvedPreview.provider}</span>
          </span>
        </span>
      </a>,
      document.body
    )
    : null

  return (
    <>
      <span className="notion-url-mention-wrapper">
        <a
          ref={triggerRef}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="notion-url-mention notion-url-mention-link-preview"
          onMouseEnter={handleOpen}
          onMouseLeave={scheduleClose}
          onFocus={handleOpen}
          onBlur={handleBlur}
        >
          <span className="notion-url-mention-icon" aria-hidden="true">
            {renderUrlMentionIcon(href, iconUrl, isGithub)}
          </span>
          <span className="notion-url-mention-label">{label}</span>
        </a>
      </span>

      {floatingCard}
    </>
  )
}
