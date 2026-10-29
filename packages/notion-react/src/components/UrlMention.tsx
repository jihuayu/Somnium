'use client'

import cn from 'classnames'
import { useMemo } from 'react'
import { createPortal } from 'react-dom'
import { getLinkPreviewPresentation } from '@jihuayu/notion-type'
import type { UrlMentionPreviewData, UrlMentionProps } from '../types'
import { isInternalHref } from '../utils/notion'
import { useFloatingHoverCard } from './useFloatingHoverCard'
import UrlMentionHoverCard, { renderUrlMentionIcon } from './UrlMentionHoverCard'

function getProviderFromHref(href: string): string {
  if (isInternalHref(href)) return 'internal link'
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

export default function UrlMention({
  href,
  label,
  iconUrl = '',
  preview,
  isGithub = false,
  variant = 'mention',
  children
}: UrlMentionProps) {
  const resolvedPreview = useMemo(
    () => preview ? mergePreviewData(buildFallbackPreview(href, label, iconUrl), preview) : null,
    [href, iconUrl, label, preview]
  )
  const isInline = variant === 'inline'
  const isInternalLink = isInternalHref(href)
  const { triggerRef, cardRef, open, floatingStyle, openCard, scheduleClose, handleBlur } =
    useFloatingHoverCard<HTMLAnchorElement, HTMLAnchorElement>({
      enabled: !!resolvedPreview,
      closeDelayMs: 90,
      viewportPadding: 12,
      gap: 10,
      initialOffset: 12,
      fallbackWidth: 360,
      fallbackHeight: 340,
      targetWidth: 360,
      minWidth: 240
    })

  const presentation = getLinkPreviewPresentation(
    resolvedPreview?.href || href,
    resolvedPreview?.title || label,
    resolvedPreview?.provider || ''
  )
  const adapterId = isGithub ? 'github' : presentation.adapterId

  const floatingCard = open && resolvedPreview
    ? createPortal(
      <UrlMentionHoverCard
        preview={resolvedPreview}
        presentation={presentation}
        providerIcon={renderUrlMentionIcon(href, resolvedPreview.icon || iconUrl, adapterId)}
        cardRef={cardRef}
        floatingStyle={floatingStyle}
        onOpen={openCard}
        onClose={scheduleClose}
        onBlur={handleBlur}
      />,
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
          className={cn(
            'notion-url-mention',
            isInline
              ? 'notion-url-mention-inline text-stone-900 dark:text-stone-100 underline underline-offset-4 decoration-stone-400 dark:decoration-stone-600'
              : 'notion-url-mention-link-preview'
          )}
          onMouseEnter={openCard}
          onMouseLeave={scheduleClose}
          onFocus={openCard}
          onBlur={handleBlur}
        >
          {isInline ? (
            children || label
          ) : (
            <>
              <span className="notion-url-mention-icon" aria-hidden="true">
                {renderUrlMentionIcon(href, iconUrl, adapterId)}
              </span>
              <span className="notion-url-mention-label">{label}</span>
            </>
          )}
        </a>
      </span>
      {floatingCard}
    </>
  )
}
