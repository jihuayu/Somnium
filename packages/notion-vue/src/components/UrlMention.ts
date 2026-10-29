import { defineComponent, h, computed, Teleport } from 'vue'
import cn from 'classnames'
import { getLinkPreviewPresentation } from '@jihuayu/notion-type'
import type { UrlMentionPreviewData } from '../types'
import { isInternalHref } from '../utils/notion'
import { useFloatingHoverCard } from './useFloatingHoverCard'
import { renderUrlMentionHoverCard, renderUrlMentionIcon } from './UrlMentionHoverCard'

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
    isGithub: { type: Boolean, default: false },
    variant: { type: String as () => 'mention' | 'inline', default: 'mention' }
  },
  setup(props, { slots }) {
    const resolvedPreview = computed(() =>
      props.preview ? mergePreviewData(buildFallbackPreview(props.href, props.label, props.iconUrl || ''), props.preview) : null
    )
    const isInline = computed(() => props.variant === 'inline')
    const isInternalLink = computed(() => isInternalHref(props.href))

    const { triggerRef, cardRef, open, isClient, floatingStyle, openCard, scheduleClose, handleBlur } =
      useFloatingHoverCard<HTMLAnchorElement, HTMLAnchorElement>({
        enabled: true,
        closeDelayMs: 90,
        viewportPadding: 12,
        gap: 10,
        initialOffset: 12,
        fallbackWidth: 360,
        fallbackHeight: 340,
        targetWidth: 360,
        minWidth: 240
      })

    return () => {
      const preview = resolvedPreview.value
      const presentation = getLinkPreviewPresentation(
        preview?.href || props.href,
        preview?.title || props.label,
        preview?.provider || ''
      )
      const adapterId = props.isGithub ? 'github' : presentation.adapterId

      const floatingCard = isClient.value && open.value && preview
        ? h(Teleport, { to: 'body' }, [
            renderUrlMentionHoverCard({
              preview,
              presentation,
              providerIcon: renderUrlMentionIcon(props.href, preview.icon || props.iconUrl || '', adapterId),
              cardRef,
              floatingStyle: floatingStyle.value,
              onOpen: openCard,
              onClose: scheduleClose,
              onBlur: handleBlur
            })
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
                ? 'notion-url-mention-inline text-stone-900 dark:text-stone-100 underline underline-offset-4 decoration-stone-400 dark:decoration-stone-600'
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
                  renderUrlMentionIcon(props.href, props.iconUrl || '', adapterId)
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
