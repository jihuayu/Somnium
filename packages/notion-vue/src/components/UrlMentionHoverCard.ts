import { h, type CSSProperties, type Ref, type VNode } from 'vue'
import type { LinkPreviewPresentation } from '@jihuayu/notion-type'
import type { UrlMentionPreviewData } from '../types'
import { isInternalHref, toOgProxyPreviewImageUrl } from '../utils/notion'

/**
 * EN: Floating GitHub-style preview for UrlMention hover. Never reuse on in-page bookmark cards.
 * ZH: UrlMention 悬浮预览专用。不要用在正文书签卡 LinkPreviewCard 上。
 */
export interface UrlMentionHoverCardOptions {
  preview: UrlMentionPreviewData
  presentation: LinkPreviewPresentation
  providerIcon: VNode
  cardRef: Ref<HTMLAnchorElement | null>
  floatingStyle: CSSProperties
  onOpen: () => void
  onClose: () => void
  onBlur: (event: FocusEvent) => void
}

function renderPreviewTitle(prefix: string, name: string) {
  if (!prefix) return name
  return [
    h('span', { class: 'notion-url-mention-hover-title-owner' }, prefix),
    h('span', { class: 'notion-url-mention-hover-title-name' }, name)
  ]
}

function renderGithubFallbackIcon() {
  return h('svg', { viewBox: '0 0 16 16', fill: 'currentColor', role: 'presentation' }, [
    h('path', { d: 'M8 0C3.58 0 0 3.58 0 8a8.001 8.001 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.08-2.7-1.08-.36-.92-.9-1.16-.9-1.16-.73-.5.06-.49.06-.49.82.06 1.25.84 1.25.84.72 1.25 1.9.89 2.36.68.07-.53.28-.9.5-1.1-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.58.82-2.13-.08-.2-.36-1.01.08-2.1 0 0 .67-.21 2.2.81.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.55.82 1.26.82 2.13 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8.001 8.001 0 0 0 16 8c0-4.42-3.58-8-8-8Z' })
  ])
}

function renderDefaultFallbackIcon() {
  return h('svg', { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', role: 'presentation' }, [
    h('path', { d: 'M8.75 6.25h-1.5a4 4 0 1 0 0 8h1.5' }),
    h('path', { d: 'M11.25 6.25h1.5a4 4 0 1 1 0 8h-1.5' }),
    h('path', { d: 'M7.5 10h5' })
  ])
}

const URL_MENTION_FALLBACK_ICONS: Record<string, () => VNode> = {
  github: renderGithubFallbackIcon
}

export function renderUrlMentionIcon(href: string, iconUrl: string, adapterId = 'default') {
  const resolvedIconUrl = toOgProxyPreviewImageUrl(iconUrl, href)
  if (resolvedIconUrl) {
    return h('img', { src: resolvedIconUrl, alt: '', class: 'h-full w-full object-contain', loading: 'lazy' })
  }

  const renderFallback = URL_MENTION_FALLBACK_ICONS[adapterId] || renderDefaultFallbackIcon
  return renderFallback()
}

export function renderUrlMentionHoverCard({
  preview,
  presentation,
  providerIcon,
  cardRef,
  floatingStyle,
  onOpen,
  onClose,
  onBlur
}: UrlMentionHoverCardOptions) {
  const isInternal = isInternalHref(preview.href)

  return h('a', {
    ref: cardRef,
    href: preview.href,
    target: isInternal ? undefined : '_blank',
    rel: isInternal ? undefined : 'noopener noreferrer',
    class: 'notion-url-mention-hover-card',
    'data-preview-kind': presentation.previewKind,
    style: floatingStyle,
    onMouseenter: onOpen,
    onMouseleave: onClose,
    onFocus: onOpen,
    onBlur
  }, [
    preview.image
      ? h('span', { class: 'notion-url-mention-hover-cover' }, [
          h('img', { src: toOgProxyPreviewImageUrl(preview.image, preview.href), alt: preview.title, loading: 'lazy' })
        ])
      : null,
    h('span', { class: 'notion-url-mention-hover-body' }, [
      h('span', { class: 'notion-url-mention-hover-title' },
        renderPreviewTitle(presentation.titlePrefix, presentation.titleName)
      ),
      preview.description
        ? h('span', { class: 'notion-url-mention-hover-description' }, preview.description)
        : null,
      h('span', { class: 'notion-url-mention-hover-footer' }, [
        h('span', { class: 'notion-url-mention-hover-provider-icon', 'aria-hidden': 'true' }, [
          providerIcon
        ]),
        h('span', { class: 'notion-url-mention-hover-provider' }, presentation.providerLabel)
      ])
    ])
  ])
}
