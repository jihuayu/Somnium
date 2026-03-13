'use client'

import { useMemo, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import dayjs from '../dayjs'
import type { DateMentionProps } from '../types'
import { useFloatingHoverCard } from './useFloatingHoverCard'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/i
const RELATIVE_TICK_MS = 60 * 1000
const subscribeNoop = () => () => {}

let relativeNowTs = Date.now()
let relativeNowTimer: number | null = null
const relativeNowSubscribers = new Set<() => void>()

function notifyRelativeNowSubscribers() {
  relativeNowTs = Date.now()
  for (const subscriber of relativeNowSubscribers) subscriber()
}

function ensureRelativeNowTimer() {
  if (typeof window === 'undefined' || relativeNowTimer !== null) return
  relativeNowTimer = window.setInterval(() => notifyRelativeNowSubscribers(), RELATIVE_TICK_MS)
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
    if (!relativeNowSubscribers.size) clearRelativeNowTimer()
  }
}

function useRelativeNow(enabled: boolean) {
  return useSyncExternalStore(
    enabled ? subscribeRelativeNow : subscribeNoop,
    enabled ? () => relativeNowTs : () => 0,
    () => 0
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

function parseMentionDate(value: string, timeZone?: string) {
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

function joinRange(startText: string, endText: string): string {
  const left = `${startText || ''}`.trim()
  const right = `${endText || ''}`.trim()
  if (!left && !right) return ''
  if (!left) return right
  if (!right) return left
  return `${left} -> ${right}`
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
  void relativeStyle

  const parsedStart = useMemo(() => parseMentionDate(start, timeZone), [start, timeZone])
  const parsedEnd = useMemo(() => parseMentionDate(end, timeZone), [end, timeZone])
  const now = useMemo(() => {
    const base = dayjs(nowTs)
    return timeZone ? base.tz(timeZone) : base
  }, [nowTs, timeZone])

  const hasTime = hasExplicitTime(start) || hasExplicitTime(end)
  const showTime = includeTime === 'never' ? false : includeTime === 'always' ? true : hasTime
  const absoluteText = joinRange(
    parsedStart ? parsedStart.format(showTime ? absoluteDateTimeFormat : absoluteDateFormat) : '',
    parsedEnd ? parsedEnd.format(showTime ? absoluteDateTimeFormat : absoluteDateFormat) : ''
  )
  const relativeText = joinRange(
    parsedStart ? parsedStart.locale(toDayjsLocale(locale)).from(now) : '',
    parsedEnd ? parsedEnd.locale(toDayjsLocale(locale)).from(now) : ''
  )

  const notionText = stripLeadingAt(fallbackText)
  const primaryRaw = primaryMode === 'relative' ? relativeText : absoluteText
  const secondaryRaw = secondaryMode === 'relative' ? relativeText : absoluteText
  const primaryText = ensureLeadingAt(primaryRaw || notionText || start || '@date')
  const secondaryText = ensureLeadingAt(secondaryRaw)
  const hasHoverCard = !!secondaryText && secondaryText !== primaryText
  const primaryBodyText = stripLeadingAt(primaryText)
  const { triggerRef, cardRef, open, floatingStyle, openCard, scheduleClose, handleBlur } =
    useFloatingHoverCard<HTMLSpanElement, HTMLDivElement>({
      enabled: hasHoverCard,
      closeDelayMs: 90,
      viewportPadding: 12,
      gap: 8,
      initialOffset: 12,
      fallbackWidth: 180,
      fallbackHeight: 46
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
