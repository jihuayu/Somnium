'use client'

import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import type { UrlMentionPreviewData, UrlMentionProps } from '../types'
import { isInternalHref } from '../utils/notion'
import { useFloatingHoverCard } from './useFloatingHoverCard'

function renderUrlMentionIcon(href: string, iconUrl: string, isGithub: boolean) {
  if (iconUrl) {
    return <img src={iconUrl} alt="" className="h-full w-full object-contain" loading="lazy" />
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
  try { return new URL(href).hostname.replace(/^www\./i, '') } catch { return href }
}

function buildFallbackPreview(href: string, label: string, iconUrl: string): UrlMentionPreviewData {
  return { href, title: label || href, description: '', icon: iconUrl || '', image: '', provider: getProviderFromHref(href) }
}

function mergePreviewData(base: UrlMentionPreviewData, incoming: Partial<UrlMentionPreviewData> | null | undefined) {
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

export default function UrlMention({ href, label, iconUrl = '', preview, isGithub }: UrlMentionProps) {
  const resolvedPreview = useMemo(
    () => mergePreviewData(buildFallbackPreview(href, label, iconUrl), preview || null),
    [href, iconUrl, label, preview]
  )
  const isInternalLink = isInternalHref(href)
  const isInternalPreviewLink = isInternalHref(resolvedPreview.href)
  const { triggerRef, cardRef, open, floatingStyle, openCard, scheduleClose, handleBlur } =
    useFloatingHoverCard<HTMLAnchorElement, HTMLAnchorElement>({
      enabled: !!resolvedPreview,
      closeDelayMs: 90,
      viewportPadding: 12,
      gap: 10,
      initialOffset: 12,
      fallbackWidth: 280,
      fallbackHeight: 220,
      targetWidth: 280,
      minWidth: 120
    })

  const floatingCard = open && resolvedPreview
    ? createPortal(
      <a
        ref={cardRef}
        href={resolvedPreview.href}
        target={isInternalPreviewLink ? undefined : '_blank'}
        rel={isInternalPreviewLink ? undefined : 'noopener noreferrer'}
        className="notion-url-mention-hover-card"
        style={floatingStyle}
        onMouseEnter={openCard}
        onMouseLeave={scheduleClose}
        onFocus={openCard}
        onBlur={handleBlur}
      >
        {resolvedPreview.image && (
          <span className="notion-url-mention-hover-cover">
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
          target={isInternalLink ? undefined : '_blank'}
          rel={isInternalLink ? undefined : 'noopener noreferrer'}
          className="notion-url-mention notion-url-mention-link-preview"
          onMouseEnter={openCard}
          onMouseLeave={scheduleClose}
          onFocus={openCard}
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
