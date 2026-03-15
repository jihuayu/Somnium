import { defineComponent, h, computed, ref, onMounted, Teleport } from 'vue'
import dayjs from '../dayjs'
import type { DateMentionProps } from '../types'
import { useFloatingHoverCard } from './useFloatingHoverCard'

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/
const OFFSET_RE = /(Z|[+-]\d{2}:\d{2})$/i
const RELATIVE_TICK_MS = 60 * 1000

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

export default defineComponent({
  name: 'DateMention',
  props: {
    start: { type: String, required: true },
    end: { type: String, default: '' },
    timeZone: { type: String, default: '' },
    locale: { type: String, required: true },
    displayMode: { type: String as () => 'notion' | 'relative' | 'absolute', required: true },
    includeTime: { type: String as () => 'auto' | 'always' | 'never', required: true },
    absoluteDateFormat: { type: String, required: true },
    absoluteDateTimeFormat: { type: String, required: true },
    relativeStyle: { type: String as () => 'long' | 'short' | 'narrow', required: true },
    fallbackText: { type: String, default: '' }
  },
  setup(props) {
    const nowTs = ref(0)

    onMounted(() => {
      nowTs.value = Date.now()
      const notify = () => { nowTs.value = Date.now() }
      relativeNowSubscribers.add(notify)
      ensureRelativeNowTimer()

      return () => {
        relativeNowSubscribers.delete(notify)
        if (!relativeNowSubscribers.size) clearRelativeNowTimer()
      }
    })

    const parsedStart = computed(() => parseMentionDate(props.start, props.timeZone))
    const parsedEnd = computed(() => parseMentionDate(props.end, props.timeZone))
    const now = computed(() => {
      const base = dayjs(nowTs.value || Date.now())
      return props.timeZone ? base.tz(props.timeZone) : base
    })

    const primaryMode = computed(() => props.displayMode === 'notion' ? 'relative' : props.displayMode)
    const secondaryMode = computed(() => primaryMode.value === 'relative' ? 'absolute' : 'relative')

    const hasTime = computed(() => hasExplicitTime(props.start) || hasExplicitTime(props.end))
    const showTime = computed(() =>
      props.includeTime === 'never' ? false : props.includeTime === 'always' ? true : hasTime.value
    )

    const absoluteText = computed(() => joinRange(
      parsedStart.value ? parsedStart.value.format(showTime.value ? props.absoluteDateTimeFormat : props.absoluteDateFormat) : '',
      parsedEnd.value ? parsedEnd.value.format(showTime.value ? props.absoluteDateTimeFormat : props.absoluteDateFormat) : ''
    ))

    const relativeText = computed(() => joinRange(
      parsedStart.value ? parsedStart.value.locale(toDayjsLocale(props.locale)).from(now.value) : '',
      parsedEnd.value ? parsedEnd.value.locale(toDayjsLocale(props.locale)).from(now.value) : ''
    ))

    const notionText = computed(() => stripLeadingAt(props.fallbackText))
    const primaryRaw = computed(() => primaryMode.value === 'relative' ? relativeText.value : absoluteText.value)
    const secondaryRaw = computed(() => secondaryMode.value === 'relative' ? relativeText.value : absoluteText.value)
    const primaryText = computed(() => ensureLeadingAt(primaryRaw.value || notionText.value || props.start || '@date'))
    const secondaryText = computed(() => ensureLeadingAt(secondaryRaw.value))
    const hasHoverCard = computed(() => !!secondaryText.value && secondaryText.value !== primaryText.value)
    const primaryBodyText = computed(() => stripLeadingAt(primaryText.value))

    const { triggerRef, cardRef, open, isClient, floatingStyle, openCard, scheduleClose, handleBlur } =
      useFloatingHoverCard<HTMLSpanElement, HTMLDivElement>({
        enabled: true,
        closeDelayMs: 120,
        viewportPadding: 12,
        gap: 6,
        initialOffset: 12,
        fallbackWidth: 180,
        fallbackHeight: 46
      })

    return () => {
      const hoverCard = isClient.value && open.value && hasHoverCard.value
        ? h(Teleport, { to: 'body' }, [
            h('div', {
              ref: cardRef,
              class: 'notion-date-mention-hover-card',
              style: floatingStyle.value,
              role: 'tooltip',
              onMouseenter: openCard,
              onMouseleave: scheduleClose,
              onFocus: openCard,
              onBlur: handleBlur
            }, [
              h('span', { class: 'notion-date-mention-hover-text' }, secondaryText.value)
            ])
          ])
        : null

      return h('span', null, [
        h('span', {
          ref: triggerRef,
          class: 'notion-date-mention',
          onMouseenter: openCard,
          onMouseleave: scheduleClose,
          onFocus: openCard,
          onBlur: handleBlur
        }, [
          h('span', { class: 'notion-date-mention-prefix', 'aria-hidden': 'true' }, '@'),
          h('span', { class: 'notion-date-mention-text' }, primaryBodyText.value)
        ]),
        hoverCard
      ])
    }
  }
})
