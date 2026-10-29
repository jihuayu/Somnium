import { Fragment } from 'react'
import cn from 'classnames'
import type {
  DateMentionProps,
  LinkPreviewMap,
  NotionRichTextDateMention,
  NotionRichTextEquation,
  NotionRichTextLinkMention,
  NotionRichTextLinkPreviewMention,
  NotionRendererComponents,
  NotionRichText,
  PageHrefMap,
  PagePreviewMap,
  ResolvedNotionRenderOptions,
  UrlMentionPreviewData
} from '../types'
import {
  extractNotionPageIdFromUrl,
  getAnnotationColorClasses,
  getUrlMentionLabel,
  isInternalHref,
  normalizeRichTextUrl,
  parseUrl,
  rewriteNotionPageHref,
  toOgProxyImageUrl
} from '../utils/notion'
import DefaultDateMention from './DateMentionStatic'
import DefaultUrlMention from './UrlMention'

function getMentionPayload(item: NotionRichText): Record<string, unknown> | null {
  const mention = (item as { mention?: unknown }).mention
  return mention && typeof mention === 'object' ? mention as Record<string, unknown> : null
}

function getTextLinkUrl(item: NotionRichText): string | null {
  if (item.type !== 'text') return null
  const text = (item as { text?: { link?: { url?: string } | null } }).text
  const link = text?.link
  return link?.url || null
}

function isLinkPreviewMention(item: NotionRichText): item is NotionRichTextLinkPreviewMention {
  const mention = getMentionPayload(item)
  return item.type === 'mention' && mention?.type === 'link_preview'
}

function isLinkMention(item: NotionRichText): item is NotionRichTextLinkMention {
  const mention = getMentionPayload(item)
  return item.type === 'mention' && mention?.type === 'link_mention'
}

function isDateMention(item: NotionRichText): item is NotionRichTextDateMention {
  const mention = getMentionPayload(item)
  return item.type === 'mention' && mention?.type === 'date'
}

function isEquationRichText(item: NotionRichText): item is NotionRichTextEquation {
  return item.type === 'equation'
}

function getRichTextLink(item: NotionRichText): string | null {
  if (item.type === 'text') return getTextLinkUrl(item)
  if (isLinkPreviewMention(item)) return item.mention?.link_preview?.url || item.href || null
  if (isLinkMention(item)) return item.mention?.link_mention?.href || item.href || null
  return item.href || null
}

function getUrlMentionTitle(item: NotionRichText): string {
  return isLinkMention(item)
    ? `${item.mention?.link_mention?.title || ''}`.trim()
    : ''
}

function getUrlMentionIconUrl(item: NotionRichText): string {
  return isLinkMention(item)
    ? toOgProxyImageUrl(`${item.mention?.link_mention?.icon_url || ''}`.trim(), getRichTextLink(item) || '')
    : ''
}

function getUrlMentionProvider(provider: string, href: string): string {
  const trimmed = `${provider || ''}`.trim()
  if (trimmed) return trimmed
  const parsed = parseUrl(href)
  return parsed ? parsed.hostname.replace(/^www\./i, '') : href
}

function getUrlMentionPreviewData(
  item: NotionRichText,
  href: string,
  label: string,
  linkPreviewMap: LinkPreviewMap
): UrlMentionPreviewData | null {
  if (!href) return null

  if (isLinkMention(item)) {
    const payload = item.mention?.link_mention || {}
    return {
      href: `${payload.href || href}`.trim() || href,
      title: `${payload.title || ''}`.trim() || label,
      description: `${payload.description || ''}`.trim(),
      icon: toOgProxyImageUrl(`${payload.icon_url || ''}`.trim(), href),
      image: toOgProxyImageUrl(`${payload.thumbnail_url || ''}`.trim(), href),
      provider: getUrlMentionProvider(`${payload.link_provider || ''}`, href)
    }
  }

  const normalized = normalizeRichTextUrl(href)
  const preview = normalized ? linkPreviewMap[normalized] : null
  if (!preview) return null

  const previewHref = `${preview.url || href}`.trim() || href
  return {
    href: previewHref,
    title: `${preview.title || ''}`.trim() || label,
    description: `${preview.description || ''}`.trim(),
    icon: toOgProxyImageUrl(`${preview.icon || ''}`.trim(), previewHref),
    image: toOgProxyImageUrl(`${preview.image || ''}`.trim(), previewHref),
    provider: getUrlMentionProvider(`${preview.hostname || ''}`, previewHref)
  }
}

function getInternalPagePreviewData(
  rawHref: string,
  href: string,
  label: string,
  pagePreviewMap: PagePreviewMap
): UrlMentionPreviewData | null {
  const pageId = extractNotionPageIdFromUrl(rawHref)
  if (!pageId) return null

  const preview = pagePreviewMap[pageId]
  if (!preview) return null

  const previewHref = `${preview.url || href}`.trim() || href
  return {
    href: previewHref,
    title: `${preview.title || ''}`.trim() || label,
    description: `${preview.description || ''}`.trim(),
    icon: toOgProxyImageUrl(`${preview.icon || ''}`.trim(), previewHref),
    image: toOgProxyImageUrl(`${preview.image || ''}`.trim(), previewHref),
    provider: getUrlMentionProvider(`${preview.hostname || ''}`, previewHref)
  }
}

interface RichTextProps {
  richText?: NotionRichText[]
  linkPreviewMap?: LinkPreviewMap
  pageHrefMap?: PageHrefMap
  pagePreviewMap?: PagePreviewMap
  renderOptions: ResolvedNotionRenderOptions
  components?: NotionRendererComponents
}

export function RichText({ richText = [], linkPreviewMap = {}, pageHrefMap = {}, pagePreviewMap = {}, renderOptions, components }: RichTextProps) {
  const DateMentionComponent = components?.leaves?.DateMention || DefaultDateMention
  const UrlMentionComponent = components?.leaves?.UrlMention || DefaultUrlMention

  if (!richText.length) return null

  return (
    <>
      {richText.map((item, index) => {
        const textContent = isEquationRichText(item)
          ? item.equation?.expression || ''
          : item.plain_text || ''
        const rawHref = getRichTextLink(item)
        const href = rewriteNotionPageHref(rawHref, pageHrefMap)
        const annotations = item.annotations || {}
        const { textColorClassName, backgroundColorClassName } = getAnnotationColorClasses(annotations)

        const content = (
          <span
            className={cn(
              annotations.bold && 'font-semibold',
              annotations.italic && 'italic',
              annotations.strikethrough && 'line-through',
              annotations.underline && 'underline',
              textColorClassName,
              backgroundColorClassName,
              annotations.code && 'notion-inline-code'
            )}
          >
            {textContent}
          </span>
        )

        if (isDateMention(item)) {
          const date = item.mention?.date || {}
          const props: DateMentionProps = {
            start: `${date.start || ''}`.trim(),
            end: `${date.end || ''}`.trim(),
            timeZone: `${date.time_zone || renderOptions.timeZone || ''}`.trim(),
            locale: renderOptions.locale,
            displayMode: renderOptions.dateMention.displayMode,
            includeTime: renderOptions.dateMention.includeTime,
            absoluteDateFormat: renderOptions.dateMention.absoluteDateFormat,
            absoluteDateTimeFormat: renderOptions.dateMention.absoluteDateTimeFormat,
            relativeStyle: renderOptions.dateMention.relativeStyle,
            fallbackText: `${item.plain_text || ''}`.trim()
          }
          return <DateMentionComponent key={`${index}-${props.start}-${props.end}`} {...props} />
        }

        if (!href) return <Fragment key={`${index}-${textContent}`}>{content}</Fragment>

        if (isLinkPreviewMention(item) || isLinkMention(item)) {
          const mentionTitle = getUrlMentionTitle(item)
          const iconUrl = getUrlMentionIconUrl(item)
          const label = mentionTitle || getUrlMentionLabel(href, textContent)
          return (
            <UrlMentionComponent
              key={`${index}-${href}`}
              href={href}
              label={label}
              iconUrl={iconUrl}
              preview={getUrlMentionPreviewData(item, href, label, linkPreviewMap)}
            />
          )
        }

        if (isInternalHref(href)) {
          const label = `${textContent || ''}`.trim() || href
          const preview = getInternalPagePreviewData(rawHref || '', href, label, pagePreviewMap)
          return (
            <UrlMentionComponent
              key={`${index}-${href}`}
              href={href}
              label={label}
              iconUrl=""
              preview={preview}
              variant="inline"
            >
              {content}
            </UrlMentionComponent>
          )
        }

        return (
          <a
            key={`${index}-${href}`}
            href={href}
            target={isInternalHref(href) ? undefined : '_blank'}
            rel={isInternalHref(href) ? undefined : 'noopener noreferrer'}
            className="text-stone-900 dark:text-stone-100 underline underline-offset-4 decoration-stone-400 dark:decoration-stone-600"
          >
            {content}
          </a>
        )
      })}
    </>
  )
}
