'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FocusEvent
} from 'react'
import { createPortal } from 'react-dom'
import dayjs from '@/lib/dayjs'
import 'dayjs/locale/zh-cn'

export type DateMentionDisplayMode = 'notion' | 'relative' | 'absolute'
export type DateMentionIncludeTimeMode = 'auto' | 'always' | 'never'
export type DateMentionRelativeStyle = 'long' | 'short' | 'narrow'

interface DateMentionProps {
  start: string
  end?: string
  timeZone?: string
  locale: string
  displayMode: DateMentionDisplayMode
  includeTime: DateMentionIncludeTimeMode
  absoluteDateFormat: string
  absoluteDateTimeFormat: string
  relativeStyle: DateMentionRelativeStyle
  fallbackText?: string
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/i
const RELATIVE_TICK_MS = 60 * 1000

const DATE_MENTION_FLOATING_CONFIG = {
  closeDelayMs: 90,
  viewportPadding: 12,
  gap: 8,
  fallbackWidth: 180,
  fallbackHeight: 46,
  initialOffset: 12
} as const

const subscribeNoop = () => () => {}

let relativeNowTs = Date.now()
let relativeNowTimer: number | null = null
const relativeNowSubscribers = new Set<() => void>()

function notifyRelativeNowSubscribers() {
  relativeNowTs = Date.now()
  for (const subscriber of relativeNowSubscribers) {
    subscriber()
  }
}

function ensureRelativeNowTimer() {
  if (typeof window === 'undefined') return
  if (relativeNowTimer !== null) return

  relativeNowTimer = window.setInterval(() => {
    notifyRelativeNowSubscribers()
  }, RELATIVE_TICK_MS)
}

function clearRelativeNowTimer() {
  if (relativeNowTimer === null) return
  window.clearInterval(relativeNowTimer)
  relativeNowTimer = null
}

function subscribeRelativeNow(onStoreChange: () => void) {
  relativeNowSubscribers.add(onStoreChange)
  ensureRelativeNowTimer()

  return () => {
    relativeNowSubscribers.delete(onStoreChange)
    if (!relativeNowSubscribers.size) {
      clearRelativeNowTimer()
    }
  }
}

function getRelativeNowSnapshot() {
  return relativeNowTs
}

function getRelativeNowDisabledSnapshot() {
  return Date.now()
}

function getRelativeNowServerSnapshot() {
  return 0
}

function useRelativeNow(enabled: boolean): number {
  return useSyncExternalStore(
    enabled ? subscribeRelativeNow : subscribeNoop,
    enabled ? getRelativeNowSnapshot : getRelativeNowDisabledSnapshot,
    getRelativeNowServerSnapshot
  )
}

function toDayjsLocale(locale: string): string {
  const normalized = `${locale || ''}`.trim().toLowerCase()
  if (!normalized) return 'zh-cn'
  if (normalized.startsWith('zh')) return 'zh-cn'
  return normalized
}

function hasExplicitTime(value?: string): boolean {
  return !!value && value.includes('T')
}

function stripLeadingAt(value: string): string {
  const trimmed = `${value || ''}`.trim()
  return trimmed.startsWith('@') ? trimmed.slice(1).trim() : trimmed
}

function ensureLeadingAt(value: string): string {
  const trimmed = `${value || ''}`.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`
}

function parseMentionDate(value: string, timeZone?: string): dayjs.Dayjs | null {
  const raw = `${value || ''}`.trim()
  if (!raw) return null

  if (DATE_ONLY_RE.test(raw)) {
    if (timeZone) {
      const zoned = dayjs.tz(`${raw}T00:00:00`, timeZone)
      return zoned.isValid() ? zoned : null
    }

    const parsed = dayjs(raw)
    return parsed.isValid() ? parsed.startOf('day') : null
  }

  if (timeZone && !OFFSET_RE.test(raw)) {
    const zoned = dayjs.tz(raw, timeZone)
    if (zoned.isValid()) return zoned
  }

  const parsed = dayjs(raw)
  if (!parsed.isValid()) return null
  return timeZone ? parsed.tz(timeZone) : parsed
}

function resolveShowTime(mode: DateMentionIncludeTimeMode, hasTime: boolean): boolean {
  if (mode === 'never') return false
  if (mode === 'always') return true
  return hasTime
}

function joinRange(startText: string, endText: string): string {
  const left = `${startText || ''}`.trim()
  const right = `${endText || ''}`.trim()
  if (!left && !right) return ''
  if (!left) return right
  if (!right) return left
  return `${left} -> ${right}`
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function formatAbsoluteText(
  value: dayjs.Dayjs | null,
  showTime: boolean,
  absoluteDateFormat: string,
  absoluteDateTimeFormat: string
): string {
  if (!value) return ''
  return value.format(showTime ? absoluteDateTimeFormat : absoluteDateFormat)
}

function formatRelativeText(
  value: dayjs.Dayjs | null,
  now: dayjs.Dayjs,
  locale: string
): string {
  if (!value) return ''
  return value.locale(toDayjsLocale(locale)).from(now)
}

export default function DateMention({
  start,
  end = '',
  timeZone = '',
  locale,
  displayMode,
  includeTime,
  absoluteDateFormat,
  absoluteDateTimeFormat,
  relativeStyle,
  fallbackText = ''
}: DateMentionProps) {
  const triggerRef = useRef<HTMLSpanElement | null>(null)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const updateRafRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const primaryMode = displayMode === 'notion' ? 'relative' : displayMode
  const secondaryMode = primaryMode === 'relative' ? 'absolute' : 'relative'
  const nowTs = useRelativeNow(primaryMode === 'relative' || open)
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>({
    position: 'fixed',
    left: DATE_MENTION_FLOATING_CONFIG.initialOffset,
    top: DATE_MENTION_FLOATING_CONFIG.initialOffset,
    visibility: 'hidden'
  })

  // Keep dependency in API surface for compatibility; dayjs relativeTime does not use style variants.
  void relativeStyle

  const parsedStart = useMemo(() => parseMentionDate(start, timeZone), [start, timeZone])
  const parsedEnd = useMemo(() => parseMentionDate(end, timeZone), [end, timeZone])
  const now = useMemo(() => {
    const base = dayjs(nowTs)
    return timeZone ? base.tz(timeZone) : base
  }, [nowTs, timeZone])

  const hasTime = hasExplicitTime(start) || hasExplicitTime(end)
  const showTime = resolveShowTime(includeTime, hasTime)

  const absoluteText = joinRange(
    formatAbsoluteText(parsedStart, showTime, absoluteDateFormat, absoluteDateTimeFormat),
    formatAbsoluteText(parsedEnd, showTime, absoluteDateFormat, absoluteDateTimeFormat)
  )

  const relativeText = joinRange(
    formatRelativeText(parsedStart, now, locale),
    formatRelativeText(parsedEnd, now, locale)
  )

  const notionText = stripLeadingAt(fallbackText)

  const primaryRaw = primaryMode === 'relative' ? relativeText : absoluteText
  const secondaryRaw = secondaryMode === 'relative' ? relativeText : absoluteText

  const primaryText = ensureLeadingAt(primaryRaw || notionText || start || '@date')
  const secondaryText = ensureLeadingAt(secondaryRaw)
  const hasHoverCard = !!secondaryText && secondaryText !== primaryText
  const primaryBodyText = stripLeadingAt(primaryText)

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
    if (!hasHoverCard) return
    clearCloseTimer()
    setOpen(true)
  }

  const scheduleClose = () => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
    }, DATE_MENTION_FLOATING_CONFIG.closeDelayMs)
  }

  const updatePosition = useCallback(() => {
    if (!open || !hasHoverCard || !triggerRef.current || !cardRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const cardElement = cardRef.current

    const viewportPadding = DATE_MENTION_FLOATING_CONFIG.viewportPadding
    const gap = DATE_MENTION_FLOATING_CONFIG.gap
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    const width = cardElement.offsetWidth || DATE_MENTION_FLOATING_CONFIG.fallbackWidth
    const height = cardElement.offsetHeight || DATE_MENTION_FLOATING_CONFIG.fallbackHeight
    const canPlaceBottom = triggerRect.bottom + gap + height + viewportPadding <= viewportHeight
    const canPlaceTop = triggerRect.top - gap - height >= viewportPadding
    const placeTop = !canPlaceBottom && canPlaceTop

    let left = clamp(triggerRect.left, viewportPadding, viewportWidth - width - viewportPadding)
    if (!Number.isFinite(left)) left = viewportPadding

    let top = placeTop ? triggerRect.top - gap - height : triggerRect.bottom + gap
    top = clamp(top, viewportPadding, viewportHeight - height - viewportPadding)
    if (!Number.isFinite(top)) top = viewportPadding

    setFloatingStyle(prev => {
      if (
        prev.position === 'fixed' &&
        prev.left === left &&
        prev.top === top &&
        prev.visibility === 'visible'
      ) {
        return prev
      }
      return {
        position: 'fixed',
        left,
        top,
        visibility: 'visible'
      }
    })
  }, [open, hasHoverCard])

  const scheduleUpdatePosition = useCallback(() => {
    clearUpdateRaf()
    updateRafRef.current = window.requestAnimationFrame(() => {
      updateRafRef.current = null
      updatePosition()
    })
  }, [updatePosition])

  useEffect(() => {
    if (!open || !hasHoverCard) return

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
  }, [open, hasHoverCard, scheduleUpdatePosition])

  useEffect(() => {
    return () => {
      clearCloseTimer()
      clearUpdateRaf()
    }
  }, [])

  const handleBlur = (event: FocusEvent<HTMLSpanElement | HTMLDivElement>) => {
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && (triggerRef.current?.contains(nextTarget) || cardRef.current?.contains(nextTarget))) return
    scheduleClose()
  }

  const hoverCard = open && hasHoverCard
    ? createPortal(
      <div
        ref={cardRef}
        className="notion-date-mention-hover-card"
        style={floatingStyle}
        role="tooltip"
        onMouseEnter={openCard}
        onMouseLeave={scheduleClose}
        onFocus={openCard}
        onBlur={handleBlur}
      >
        <span className="notion-date-mention-hover-text">{secondaryText}</span>
      </div>,
      document.body
    )
    : null

  return (
    <>
      <span
        ref={triggerRef}
        className="notion-date-mention"
        suppressHydrationWarning
        onMouseEnter={openCard}
        onMouseLeave={scheduleClose}
        onFocus={openCard}
        onBlur={handleBlur}
      >
        <span className="notion-date-mention-prefix" aria-hidden="true">@</span>
        <span className="notion-date-mention-text">{primaryBodyText}</span>
      </span>
      {hoverCard}
    </>
  )
}
