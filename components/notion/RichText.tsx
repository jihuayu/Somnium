import { Fragment } from 'react'
import cn from 'classnames'
import { config } from '@/lib/server/config'
import UrlMention, { type UrlMentionPreviewData } from '@/components/UrlMention'
import DateMention, {
  type DateMentionDisplayMode,
  type DateMentionIncludeTimeMode,
  type DateMentionRelativeStyle
} from '@/components/DateMention'
import type { LinkPreviewMap } from '@/lib/link-preview/types'

export { getPlainTextFromRichText } from '@/lib/notion/render-utils'

export function normalizeRichTextUrl(url: string | null): string {
  if (!url) return ''
  try { return new URL(url).toString() } catch { return '' }
}

function parseUrl(url: string | null): URL | null {
  if (!url) return null
  try { return new URL(url) } catch { return null }
}

function isGithubUrl(url: string | null): boolean {
  const parsed = parseUrl(url)
  if (!parsed) return false
  const hostname = parsed.hostname.toLowerCase()
  return hostname === 'github.com' || hostname === 'www.github.com'
}

function looksLikeHttpUrl(text: string): boolean {
  return /^https?:\/\//i.test(text.trim())
}

function decodePathSegment(segment: string): string {
  if (!segment) return ''
  try { return decodeURIComponent(segment) } catch { return segment }
}

function getUrlMentionLabel(href: string, textContent: string): string {
  const trimmedText = textContent.trim()
  if (trimmedText && !looksLikeHttpUrl(trimmedText)) return trimmedText

  const parsed = parseUrl(href)
  if (!parsed) return trimmedText || 'link'

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (isGithubUrl(href) && segments.length >= 2) return decodePathSegment(segments[1])
  if (segments.length >= 1) return decodePathSegment(segments[segments.length - 1])
  return parsed.hostname || 'link'
}

function isLinkPreviewMention(item: any): boolean {
  return item?.type === 'mention' && item?.mention?.type === 'link_preview'
}

function isLinkMention(item: any): boolean {
  return item?.type === 'mention' && item?.mention?.type === 'link_mention'
}

function isDateMention(item: any): boolean {
  return item?.type === 'mention' && item?.mention?.type === 'date'
}

function isUrlMention(item: any): boolean {
  return isLinkPreviewMention(item) || isLinkMention(item)
}

const ANNOTATION_COLOR_CLASS_MAP: Record<string, string> = {
  gray: 'notion-color-gray',
  brown: 'notion-color-brown',
  orange: 'notion-color-orange',
  yellow: 'notion-color-yellow',
  green: 'notion-color-green',
  teal: 'notion-color-green',
  blue: 'notion-color-blue',
  purple: 'notion-color-purple',
  pink: 'notion-color-pink',
  red: 'notion-color-red',
  gray_background: 'notion-color-gray-bg',
  brown_background: 'notion-color-brown-bg',
  orange_background: 'notion-color-orange-bg',
  yellow_background: 'notion-color-yellow-bg',
  green_background: 'notion-color-green-bg',
  teal_background: 'notion-color-green-bg',
  blue_background: 'notion-color-blue-bg',
  purple_background: 'notion-color-purple-bg',
  pink_background: 'notion-color-pink-bg',
  red_background: 'notion-color-red-bg'
}

function getAnnotationColorClass(color: unknown): string {
  if (typeof color !== 'string') return ''
  const normalized = color.trim().toLowerCase()
  if (!normalized || normalized === 'default') return ''
  return ANNOTATION_COLOR_CLASS_MAP[normalized] || ''
}

const DATE_MENTION_DEFAULTS = {
  display: 'relative' as DateMentionDisplayMode,
  includeTime: 'always' as DateMentionIncludeTimeMode,
  absoluteDateFormat: 'YYYY年M月D日',
  absoluteDateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
  relativeStyle: 'short' as DateMentionRelativeStyle
}

function toDateMentionDisplayMode(value: unknown): DateMentionDisplayMode {
  return value === 'relative' || value === 'absolute' || value === 'notion'
    ? value
    : DATE_MENTION_DEFAULTS.display
}

function toDateMentionIncludeTimeMode(value: unknown): DateMentionIncludeTimeMode {
  return value === 'always' || value === 'never' || value === 'auto'
    ? value
    : DATE_MENTION_DEFAULTS.includeTime
}

function toDateMentionRelativeStyle(value: unknown): DateMentionRelativeStyle {
  return value === 'long' || value === 'short' || value === 'narrow'
    ? value
    : DATE_MENTION_DEFAULTS.relativeStyle
}

const DATE_MENTION_OPTIONS = (() => {
  const raw: Partial<NonNullable<typeof config.notionDateMention>> = config.notionDateMention || {}

  return {
    display: toDateMentionDisplayMode(raw.display),
    includeTime: toDateMentionIncludeTimeMode(raw.includeTime),
    absoluteDateFormat: `${raw.absoluteDateFormat || DATE_MENTION_DEFAULTS.absoluteDateFormat}`.trim() || DATE_MENTION_DEFAULTS.absoluteDateFormat,
    absoluteDateTimeFormat:
      `${raw.absoluteDateTimeFormat || DATE_MENTION_DEFAULTS.absoluteDateTimeFormat}`.trim() ||
      DATE_MENTION_DEFAULTS.absoluteDateTimeFormat,
    relativeStyle: toDateMentionRelativeStyle(raw.relativeStyle)
  }
})()

function getDateMentionFallbackText(item: any): string {
  return `${item?.plain_text || ''}`.trim()
}

function getRichTextLink(item: any): string | null {
  if (!item || typeof item !== 'object') return null

  if (item.type === 'text') {
    return item?.text?.link?.url || null
  }

  if (isLinkPreviewMention(item)) {
    return item?.mention?.link_preview?.url || item?.href || null
  }

  if (isLinkMention(item)) {
    return item?.mention?.link_mention?.href || item?.href || null
  }

  return item?.href || null
}

function getUrlMentionTitle(item: any): string {
  if (!isLinkMention(item)) return ''
  return `${item?.mention?.link_mention?.title || ''}`.trim()
}

function getUrlMentionIconUrl(item: any): string {
  if (!isLinkMention(item)) return ''
  return `${item?.mention?.link_mention?.icon_url || ''}`.trim()
}

function getUrlMentionProvider(provider: string, href: string): string {
  const trimmed = `${provider || ''}`.trim()
  if (trimmed) return trimmed

  const parsed = parseUrl(href)
  if (!parsed) return href
  return parsed.hostname.replace(/^www\./i, '')
}

function getUrlMentionPreviewData(
  item: any,
  href: string,
  label: string,
  linkPreviewMap: LinkPreviewMap
): UrlMentionPreviewData | null {
  if (!href) return null

  if (isLinkMention(item)) {
    const payload = item?.mention?.link_mention || {}
    return {
      href: `${payload?.href || href}`.trim() || href,
      title: `${payload?.title || ''}`.trim() || label,
      description: `${payload?.description || ''}`.trim(),
      icon: `${payload?.icon_url || ''}`.trim(),
      image: `${payload?.thumbnail_url || ''}`.trim(),
      provider: getUrlMentionProvider(`${payload?.link_provider || ''}`, href)
    }
  }

  const normalized = normalizeRichTextUrl(href)
  const preview = normalized ? linkPreviewMap[normalized] : null
  if (preview) {
    const previewHref = `${preview.url || href}`.trim() || href
    return {
      href: previewHref,
      title: `${preview.title || ''}`.trim() || label,
      description: `${preview.description || ''}`.trim(),
      icon: `${preview.icon || ''}`.trim(),
      image: `${preview.image || ''}`.trim(),
      provider: getUrlMentionProvider(`${preview.hostname || ''}`, previewHref)
    }
  }

  const parsed = parseUrl(href)
  if (!parsed) return null

  return {
    href,
    title: label || parsed.hostname,
    description: '',
    icon: '',
    image: '',
    provider: getUrlMentionProvider('', href)
  }
}

interface RichTextProps {
  richText?: any[]
  linkPreviewMap?: LinkPreviewMap
}

export function RichText({ richText = [], linkPreviewMap = {} }: RichTextProps) {
  if (!richText.length) return null

  return (
    <>
      {richText.map((item: any, index: number) => {
        const textContent = item?.type === 'equation'
          ? item?.equation?.expression || ''
          : item?.plain_text || ''
        const href = getRichTextLink(item)
        const annotations = item?.annotations || {}
        const colorClassName = getAnnotationColorClass(annotations.color)

        const content = (
          <span
            className={cn(
              annotations.bold && 'font-semibold',
              annotations.italic && 'italic',
              annotations.strikethrough && 'line-through',
              annotations.underline && 'underline',
              colorClassName,
              annotations.code &&
                'font-mono text-[0.9em] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800'
            )}
          >
            {textContent}
          </span>
        )

        if (isDateMention(item)) {
          const date = item?.mention?.date || {}
          const start = `${date?.start || ''}`.trim()
          const end = `${date?.end || ''}`.trim()
          const timeZone = `${date?.time_zone || config.timezone || ''}`.trim()
          return (
            <DateMention
              key={`${index}-${start}-${end}`}
              start={start}
              end={end}
              timeZone={timeZone}
              locale={config.lang}
              displayMode={DATE_MENTION_OPTIONS.display}
              includeTime={DATE_MENTION_OPTIONS.includeTime}
              absoluteDateFormat={DATE_MENTION_OPTIONS.absoluteDateFormat}
              absoluteDateTimeFormat={DATE_MENTION_OPTIONS.absoluteDateTimeFormat}
              relativeStyle={DATE_MENTION_OPTIONS.relativeStyle}
              fallbackText={getDateMentionFallbackText(item)}
            />
          )
        }

        if (!href) {
          return <Fragment key={`${index}-${textContent}`}>{content}</Fragment>
        }

        if (isUrlMention(item)) {
          const mentionTitle = getUrlMentionTitle(item)
          const iconUrl = getUrlMentionIconUrl(item)
          const label = mentionTitle || getUrlMentionLabel(href, textContent)
          const preview = getUrlMentionPreviewData(item, href, label, linkPreviewMap)
          const isGithub = isGithubUrl(href)
          return (
            <UrlMention
              key={`${index}-${href}`}
              href={href}
              label={label}
              iconUrl={iconUrl}
              preview={preview}
              isGithub={isGithub}
            />
          )
        }

        return (
          <a
            key={`${index}-${href}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline underline-offset-4"
          >
            {content}
          </a>
        )
      })}
    </>
  )
}
