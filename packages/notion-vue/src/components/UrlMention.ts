import { defineComponent, h, computed, Teleport } from 'vue'
import cn from 'classnames'
import type { UrlMentionPreviewData, UrlMentionProps } from '../types'
import { isInternalHref } from '../utils/notion'
import { useFloatingHoverCard } from './useFloatingHoverCard'

function renderUrlMentionIcon(href: string, iconUrl: string, isGithub: boolean) {
  if (iconUrl) {
    return h('img', { src: iconUrl, alt: '', class: 'h-full w-full object-contain', loading: 'lazy' })
  }

  if (isGithub || /^https?:\/\/(?:www\.)?github\.com\/?/i.test(href)) {
    return h('svg', { viewBox: '0 0 16 16', fill: 'currentColor', role: 'presentation' }, [
      h('path', { d: 'M8 0C3.58 0 0 3.58 0 8a8.001 8.001 0 0 0 5.47 7.59c.4.07.55-.17.55-.38v-1.34c-2.23.49-2.7-1.08-2.7-1.08-.36-.92-.9-1.16-.9-1.16-.73-.5.06-.49.06-.49.82.06 1.25.84 1.25.84.72 1.25 1.9.89 2.36.68.07-.53.28-.9.5-1.1-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.58.82-2.13-.08-.2-.36-1.01.08-2.1 0 0 .67-.21 2.2.81.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.91.08 2.11.51.55.82 1.26.82 2.13 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.19c0 .21.15.46.55.38A8.001 8.001 0 0 0 16 8c0-4.42-3.58-8-8-8Z' })
    ])
  }

  return h('svg', { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: '1.8', role: 'presentation' }, [
    h('path', { d: 'M8.75 6.25h-1.5a4 4 0 1 0 0 8h1.5' }),
    h('path', { d: 'M11.25 6.25h1.5a4 4 0 1 1 0 8h-1.5' }),
    h('path', { d: 'M7.5 10h5' })
  ])
}

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

export default defineComponent({
  name: 'UrlMention',
  props: {
    href: { type: String, required: true },
    label: { type: String, required: true },
    iconUrl: { type: String, default: '' },
    preview: { type: Object as () => UrlMentionPreviewData | null, default: null },
    isGithub: { type: Boolean, required: true },
    variant: { type: String as () => 'mention' | 'inline', default: 'mention' }
  },
  setup(props, { slots }) {
    const resolvedPreview = computed(() =>
      props.preview ? mergePreviewData(buildFallbackPreview(props.href, props.label, props.iconUrl || ''), props.preview) : null
    )
    const isInline = computed(() => props.variant === 'inline')
    const isInternalLink = computed(() => isInternalHref(props.href))
    const isInternalPreviewLink = computed(() => resolvedPreview.value ? isInternalHref(resolvedPreview.value.href) : false)

    const { triggerRef, cardRef, open, isClient, floatingStyle, openCard, scheduleClose, handleBlur } =
      useFloatingHoverCard<HTMLAnchorElement, HTMLAnchorElement>({
        enabled: true,
        closeDelayMs: 90,
        viewportPadding: 12,
        gap: 10,
        initialOffset: 12,
        fallbackWidth: 280,
        fallbackHeight: 220,
        targetWidth: 280,
        minWidth: 120
      })

    return () => {
      const preview = resolvedPreview.value

      const floatingCard = isClient.value && open.value && preview
        ? h(Teleport, { to: 'body' }, [
            h('a', {
              ref: cardRef,
              href: preview.href,
              target: isInternalPreviewLink.value ? undefined : '_blank',
              rel: isInternalPreviewLink.value ? undefined : 'noopener noreferrer',
              class: 'notion-url-mention-hover-card',
              style: floatingStyle.value,
              onMouseenter: openCard,
              onMouseleave: scheduleClose,
              onFocus: openCard,
              onBlur: handleBlur
            }, [
              preview.image
                ? h('span', { class: 'notion-url-mention-hover-cover' }, [
                    h('img', { src: preview.image, alt: preview.title, loading: 'lazy' })
                  ])
                : null,
              h('span', { class: 'notion-url-mention-hover-body' }, [
                h('span', { class: 'notion-url-mention-hover-title' }, preview.title || props.label),
                preview.description
                  ? h('span', { class: 'notion-url-mention-hover-description' }, preview.description)
                  : null,
                h('span', { class: 'notion-url-mention-hover-footer' }, [
                  h('span', { class: 'notion-url-mention-hover-provider-icon', 'aria-hidden': 'true' }, [
                    renderUrlMentionIcon(props.href, preview.icon || props.iconUrl || '', props.isGithub)
                  ]),
                  h('span', { class: 'notion-url-mention-hover-provider' }, preview.provider)
                ])
              ])
            ])
          ])
        : null

      return h('span', null, [
        h('span', { class: 'notion-url-mention-wrapper' }, [
          h('a', {
            ref: triggerRef,
            href: props.href,
            target: isInternalLink.value ? undefined : '_blank',
            rel: isInternalLink.value ? undefined : 'noopener noreferrer',
            class: cn(
              'notion-url-mention',
              isInline.value
                ? 'notion-url-mention-inline text-blue-600 dark:text-blue-400 underline underline-offset-4'
                : 'notion-url-mention-link-preview'
            ),
            onMouseenter: openCard,
            onMouseleave: scheduleClose,
            onFocus: openCard,
            onBlur: handleBlur
          }, isInline.value
            ? [slots.default ? slots.default() : props.label]
            : [
                h('span', { class: 'notion-url-mention-icon', 'aria-hidden': 'true' }, [
                  renderUrlMentionIcon(props.href, props.iconUrl || '', props.isGithub)
                ]),
                h('span', { class: 'notion-url-mention-label' }, props.label)
              ]
          )
        ]),
        floatingCard
      ])
    }
  }
})
