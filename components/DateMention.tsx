'use client'

import {
  useMemo,
  useSyncExternalStore
} from 'react'
import { createPortal } from 'react-dom'
import dayjs from '@/lib/dayjs'
import { useFloatingHoverCard } from '@/components/hooks/useFloatingHoverCard'
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
  return 0
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
  const primaryMode = displayMode === 'notion' ? 'relative' : displayMode
  const secondaryMode = primaryMode === 'relative' ? 'absolute' : 'relative'
  const nowTs = useRelativeNow(true)

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
  const {
    triggerRef,
    cardRef,
    open,
    floatingStyle,
    openCard,
    scheduleClose,
    handleBlur
  } = useFloatingHoverCard<HTMLSpanElement, HTMLDivElement>({
    enabled: hasHoverCard,
    closeDelayMs: DATE_MENTION_FLOATING_CONFIG.closeDelayMs,
    viewportPadding: DATE_MENTION_FLOATING_CONFIG.viewportPadding,
    gap: DATE_MENTION_FLOATING_CONFIG.gap,
    initialOffset: DATE_MENTION_FLOATING_CONFIG.initialOffset,
    fallbackWidth: DATE_MENTION_FLOATING_CONFIG.fallbackWidth,
    fallbackHeight: DATE_MENTION_FLOATING_CONFIG.fallbackHeight
  })

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
