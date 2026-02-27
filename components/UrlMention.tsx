'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react'
import { createPortal } from 'react-dom'

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
  fallbackHeight: 220,
  initialOffset: 12
} as const

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export default function UrlMention({
  href,
  label,
  iconUrl = '',
  preview,
  isGithub
}: UrlMentionProps) {
  const triggerRef = useRef<HTMLAnchorElement | null>(null)
  const cardRef = useRef<HTMLAnchorElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const updateRafRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: URL_MENTION_FLOATING_CONFIG.initialOffset,
    top: URL_MENTION_FLOATING_CONFIG.initialOffset,
    width: URL_MENTION_FLOATING_CONFIG.targetWidth,
    visibility: 'hidden'
  })

  const clearCloseTimer = () => {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }

  const clearUpdateRaf = () => {
    if (updateRafRef.current === null) return
    window.cancelAnimationFrame(updateRafRef.current)
    updateRafRef.current = null
  }

  const openCard = () => {
    if (!preview) return
    clearCloseTimer()
    setOpen(true)
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
    }, URL_MENTION_FLOATING_CONFIG.closeDelayMs)
  }

  const updatePosition = useCallback(() => {
    if (!open || !preview || !triggerRef.current || !cardRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const cardElement = cardRef.current

    const viewportPadding = URL_MENTION_FLOATING_CONFIG.viewportPadding
    const gap = URL_MENTION_FLOATING_CONFIG.gap
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const width = Math.min(
      URL_MENTION_FLOATING_CONFIG.targetWidth,
      Math.max(URL_MENTION_FLOATING_CONFIG.minWidth, viewportWidth - viewportPadding * 2)
    )
    const height = cardElement.offsetHeight || URL_MENTION_FLOATING_CONFIG.fallbackHeight
    const canPlaceBottom = triggerRect.bottom + gap + height + viewportPadding <= viewportHeight
    const canPlaceTop = triggerRect.top - gap - height >= viewportPadding
    const placeTop = !canPlaceBottom && canPlaceTop

    let left = clamp(triggerRect.left, viewportPadding, viewportWidth - width - viewportPadding)
    if (!Number.isFinite(left)) left = viewportPadding

    let top = placeTop ? triggerRect.top - gap - height : triggerRect.bottom + gap
    top = clamp(top, viewportPadding, viewportHeight - height - viewportPadding)
    if (!Number.isFinite(top)) top = viewportPadding

    setFloatingStyle({
      position: 'fixed',
      left,
      top,
      width,
      visibility: 'visible'
    })
  }, [open, preview])

  const scheduleUpdatePosition = useCallback(() => {
    clearUpdateRaf()
    updateRafRef.current = window.requestAnimationFrame(() => {
      updateRafRef.current = null
      updatePosition()
    })
  }, [updatePosition])

  useEffect(() => {
    if (!open || !preview) return

    scheduleUpdatePosition()
    const handleViewportChange = () => scheduleUpdatePosition()
    const observer = cardRef.current
      ? new ResizeObserver(() => scheduleUpdatePosition())
      : null

    if (cardRef.current && observer) observer.observe(cardRef.current)

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, true)

    return () => {
      clearUpdateRaf()
      observer?.disconnect()
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [open, preview, scheduleUpdatePosition])

  useEffect(() => {
    return () => {
      clearCloseTimer()
      clearUpdateRaf()
    }
  }, [])

  const handleBlur = (event: FocusEvent<HTMLAnchorElement>) => {
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && (triggerRef.current?.contains(nextTarget) || cardRef.current?.contains(nextTarget))) return
    scheduleClose()
  }

  const floatingCard = open && preview
    ? createPortal(
      <a
        ref={cardRef}
        href={preview.href}
        target="_blank"
        rel="noopener noreferrer"
        className="notion-url-mention-hover-card"
        style={floatingStyle}
        onMouseEnter={openCard}
        onMouseLeave={scheduleClose}
        onFocus={openCard}
        onBlur={handleBlur}
      >
        {preview.image && (
          <span className="notion-url-mention-hover-cover">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview.image} alt={preview.title} loading="lazy" onLoad={scheduleUpdatePosition} />
          </span>
        )}

        <span className="notion-url-mention-hover-body">
          <span className="notion-url-mention-hover-title">{preview.title || label}</span>
          {preview.description && (
            <span className="notion-url-mention-hover-description">{preview.description}</span>
          )}
          <span className="notion-url-mention-hover-footer">
            <span className="notion-url-mention-hover-provider-icon" aria-hidden="true">
              {renderUrlMentionIcon(href, preview.icon || iconUrl, isGithub)}
            </span>
            <span className="notion-url-mention-hover-provider">{preview.provider}</span>
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
