import { defineComponent, h } from 'vue'
import cn from 'classnames'
import type { LinkPreviewCardProps } from '../types'
import { buildFallbackLinkPreview, normalizePreviewUrl } from '../utils/notion'

export default defineComponent({
  name: 'LinkPreviewCard',
  props: {
    url: { type: String, required: true },
    class: { type: String, default: '' },
    preview: { type: Object as () => import('../types').LinkPreviewData | null | undefined, default: null }
  },
  setup(props) {
    return () => {
      const normalizedUrl = normalizePreviewUrl(props.url) || ''
      const fallback = buildFallbackLinkPreview(normalizedUrl || props.url)
      const resolvedPreview = {
        ...fallback,
        ...(props.preview || {}),
        url: props.preview?.url || normalizedUrl || fallback.url
      }

      const displayUrl = resolvedPreview.url || normalizedUrl
      const generatedImageUrl = displayUrl ? `${resolvedPreview.image || ''}`.trim() : ''
      if (!displayUrl) return null

      return h('a', {
        href: displayUrl,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-link-preview-card': 'true',
        'data-has-image': generatedImageUrl ? 'true' : 'false',
        class: cn(
          'link-preview-card block my-4 h-[110px] rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
          props.class
        ),
        style: 'opacity: 1'
      }, [
        h('div', { class: 'link-preview-card-inner flex h-full items-stretch' }, [
          h('div', {
            class: cn(
              'link-preview-card-main min-w-0 flex flex-col px-3 py-2',
              generatedImageUrl ? 'basis-[65%] shrink-0' : 'flex-1'
            )
          }, [
            h('p', { class: 'text-base text-zinc-900 dark:text-zinc-100 font-medium truncate' },
              resolvedPreview.title || resolvedPreview.hostname || displayUrl
            ),
            resolvedPreview.description
              ? h('p', {
                  class: 'mt-0.5 text-zinc-600 dark:text-zinc-300 text-sm leading-5 overflow-hidden',
                  style: 'display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;'
                }, resolvedPreview.description)
              : null,
            h('div', { class: 'mt-auto pt-1.5 flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-xs' }, [
              resolvedPreview.icon
                ? h('span', { class: 'relative h-4 w-4 rounded-sm flex-none overflow-hidden bg-transparent' }, [
                    h('img', {
                      src: resolvedPreview.icon,
                      alt: '',
                      class: 'h-4 w-4 rounded-sm bg-transparent object-contain',
                      loading: 'lazy'
                    })
                  ])
                : h('span', { class: 'h-4 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-700 flex-none' }),
              h('span', { class: 'truncate' }, displayUrl)
            ])
          ]),
          generatedImageUrl
            ? h('div', { class: 'link-preview-card-media basis-[35%] shrink-0 h-full' }, [
                h('div', { class: 'relative h-full w-full overflow-hidden bg-zinc-200/80 dark:bg-zinc-700/70' }, [
                  h('img', {
                    src: generatedImageUrl,
                    alt: resolvedPreview.title || resolvedPreview.hostname || 'Link preview',
                    class: 'link-preview-cover pointer-events-none h-full w-full object-cover transition-opacity duration-200',
                    style: 'filter: none',
                    loading: 'lazy'
                  })
                ])
              ])
            : null
        ])
      ])
    }
  }
})
