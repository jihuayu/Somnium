import { defineComponent, h, type VNodeChild, type Component } from 'vue'
import cn from 'classnames'
import katex from 'katex'
import type {
  BlockRenderer,
  BlockRendererProps,
  LinkPreviewCardProps,
  NotionBlock,
  NotionBookmarkBlock,
  NotionBulletedListItemBlock,
  NotionCalloutBlock,
  NotionChildDatabaseBlock,
  NotionChildPageBlock,
  NotionColumnBlock,
  NotionCodeBlock,
  NotionEmbedBlock,
  NotionEquationBlock,
  NotionFileBlock,
  NotionImageBlock,
  NotionLinkPreviewBlock,
  NotionLinkToPageBlock,
  NotionNumberedListItemBlock,
  NotionBlockType,
  NotionParagraphBlock,
  NotionPdfBlock,
  NotionQuoteBlock,
  NotionRenderOptions,
  NotionRendererProps,
  ResolvedNotionRenderOptions,
  NotionSyncedBlock,
  NotionTableRowBlock,
  NotionTableBlock,
  NotionTemplateBlock,
  NotionToDoBlock,
  NotionToggleBlock,
  NotionVideoBlock,
  NotionAudioBlock,
  NotionHeading1Block,
  NotionHeading2Block,
  NotionHeading3Block,
  UnsupportedBlockProps
} from '../types'
import {
  buildNotionPublicUrl,
  escapeHtml,
  getBlockClassName,
  getCalloutIconUrl,
  getFileBlockName,
  getFileBlockUrl,
  getHeadingAnchorId,
  getLinkToPageLabel,
  getPlainTextFromRichText,
  normalizeCodeLanguage,
  normalizeNotionEntityId,
  normalizeRichTextUrl,
  renderFallbackHighlightedCodeHtml,
  resolveEmbedIframeUrl
} from '../utils/notion'
import DefaultLinkPreviewCard from './LinkPreviewCard'
import DefaultMermaidBlock from './MermaidBlock'
import { RichText } from './RichText'

function renderEquationHtml(expression: string, displayMode = false): string {
  if (!expression) return ''
  try {
    return katex.renderToString(expression, { displayMode, throwOnError: false, strict: 'ignore' })
  } catch {
    return escapeHtml(expression)
  }
}

function resolveRenderOptions(input?: NotionRenderOptions): ResolvedNotionRenderOptions {
  return {
    locale: `${input?.locale || 'zh-CN'}`.trim() || 'zh-CN',
    timeZone: `${input?.timeZone || ''}`.trim(),
    dateMention: {
      displayMode: input?.dateMention?.displayMode || 'relative',
      includeTime: input?.dateMention?.includeTime || 'always',
      absoluteDateFormat: `${input?.dateMention?.absoluteDateFormat || 'YYYY年M月D日'}`.trim() || 'YYYY年M月D日',
      absoluteDateTimeFormat:
        `${input?.dateMention?.absoluteDateTimeFormat || 'YYYY年M月D日 HH:mm:ss'}`.trim() || 'YYYY年M月D日 HH:mm:ss',
      relativeStyle: input?.dateMention?.relativeStyle || 'short'
    }
  }
}

const DefaultUnsupportedBlock = defineComponent({
  name: 'UnsupportedBlock',
  props: {
    block: { type: Object as () => NotionBlock, required: true },
    class: { type: String, default: '' },
    message: { type: String, default: '' }
  },
  setup(props) {
    return () => h('div', { class: props.class }, [
      h('div', {
        class: 'my-4 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400'
      }, props.message || `Unsupported block type: ${props.block.type}`)
    ])
  }
})

function isTableRowBlock(block: NotionBlock | undefined): block is NotionTableRowBlock {
  return block?.type === 'table_row'
}

function isBulletedListItemBlock(block: NotionBlock | undefined): block is NotionBulletedListItemBlock {
  return block?.type === 'bulleted_list_item'
}

function isNumberedListItemBlock(block: NotionBlock | undefined): block is NotionNumberedListItemBlock {
  return block?.type === 'numbered_list_item'
}

function isParagraphBlock(block: NotionBlock | undefined): block is NotionParagraphBlock {
  return block?.type === 'paragraph'
}

export default defineComponent({
  name: 'NotionRenderer',
  props: {
    model: { type: Object as () => import('../types').NotionRenderModel, required: true },
    components: { type: Object as () => import('../types').NotionRendererComponents | undefined, default: undefined },
    renderOptions: { type: Object as () => NotionRenderOptions | undefined, default: undefined },
    class: { type: String, default: '' },
    style: { type: Object as () => Record<string, string> | undefined, default: undefined }
  },
  setup(props) {
    return () => {
      const resolvedRenderOptions = resolveRenderOptions(props.renderOptions)
      const LinkPreviewCard = (props.components?.leaves?.LinkPreviewCard || DefaultLinkPreviewCard) as Component
      const MermaidBlock = (props.components?.leaves?.MermaidBlock || DefaultMermaidBlock) as Component
      const Unsupported = (props.components?.leaves?.UnsupportedBlock || DefaultUnsupportedBlock) as Component
      const model = props.model
      const document = model.document
      const blocksById = document.blocksById || {}
      const childrenById = document.childrenById || {}
      const rootIds = document.rootIds || []

      function renderRichText(richText: import('../types').NotionRichText[] = []): VNodeChild {
        return h(RichText, {
          richText,
          linkPreviewMap: model.linkPreviewMap,
          pageHrefMap: model.pageHrefMap,
          pagePreviewMap: model.pagePreviewMap,
          renderOptions: resolvedRenderOptions,
          components: props.components
        })
      }

      function renderChildren(blockId: string): VNodeChild {
        const childIds = childrenById[blockId] || []
        if (!childIds.length) return null
        return renderBlockList(childIds)
      }

      function renderBlockWithOverride(block: NotionBlock, fallback: () => VNodeChild): VNodeChild {
        const customRenderer = props.components?.blocks?.[block.type]
        if (!customRenderer) return fallback()

        const blockProps: BlockRendererProps = {
          block,
          model,
          renderOptions: resolvedRenderOptions,
          renderChildren,
          renderRichText
        }
        return customRenderer(blockProps)
      }

      function renderLinkPreviewCard(url: string, previewKey: string, extraClass?: string): VNodeChild {
        const cardProps: LinkPreviewCardProps = {
          url,
          className: extraClass,
          preview: model.linkPreviewMap[previewKey]
        }
        return h(LinkPreviewCard, cardProps)
      }

      function renderBulletedListItem(block: NotionBulletedListItemBlock): VNodeChild {
        return renderBlockWithOverride(block, () => h('li', { key: block.id, class: getBlockClassName(block.id) }, [
          h('div', { class: 'notion-text whitespace-pre-wrap' }, [renderRichText(block.bulleted_list_item.rich_text)]),
          renderChildren(block.id)
        ]))
      }

      function renderNumberedListItem(block: NotionNumberedListItemBlock): VNodeChild {
        return renderBlockWithOverride(block, () => h('li', { key: block.id, class: getBlockClassName(block.id) }, [
          h('div', { class: 'notion-text whitespace-pre-wrap' }, [renderRichText(block.numbered_list_item.rich_text)]),
          renderChildren(block.id)
        ]))
      }

      function renderToDoItem(block: NotionToDoBlock): VNodeChild {
        return renderBlockWithOverride(block, () => {
          const checked = !!block.to_do.checked
          return h('div', { key: block.id, class: cn(getBlockClassName(block.id), 'notion-to-do-block') }, [
            h('div', { class: 'notion-to-do-item flex items-baseline gap-1' }, [
              h('span', { class: 'notion-property-checkbox' }, [
                h('span', {
                  class: cn('notion-to-do-checkbox', checked && 'is-checked'),
                  role: 'img',
                  'aria-label': checked ? 'Checked' : 'Unchecked'
                }, checked ? [
                  h('svg', { viewBox: '0 0 20 20', fill: 'none', 'aria-hidden': 'true' }, [
                    h('path', { d: 'M4.5 10.5 8.3 14.3 15.5 6.8' })
                  ])
                ] : null)
              ]),
              h('div', { class: 'notion-to-do-body flex-1 min-w-0 whitespace-pre-wrap' }, [renderRichText(block.to_do.rich_text)])
            ]),
            h('div', { class: 'pl-7' }, [renderChildren(block.id)])
          ])
        })
      }

      function renderColumnBlock(block: NotionColumnBlock): VNodeChild {
        return renderBlockWithOverride(block, () => h('div', {
          key: block.id,
          class: getBlockClassName(block.id),
          style: { flex: String(block.column.width_ratio || 1), minWidth: '0' }
        }, [renderChildren(block.id)]))
      }

      function renderPageReferenceCard(label: string, href: string, blockClass: string, prefix: string): VNodeChild {
        const isInternal = href.startsWith('/')
        const cardClassName = 'inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300'
        return h('div', { class: cn(blockClass, 'my-3') }, [
          href
            ? h('a', {
                href,
                target: isInternal ? undefined : '_blank',
                rel: isInternal ? undefined : 'noopener noreferrer',
                class: cn(cardClassName, 'hover:border-zinc-400 dark:hover:border-zinc-500')
              }, [
                h('span', { 'aria-hidden': 'true' }, prefix),
                h('span', { class: 'whitespace-pre-wrap' }, label)
              ])
            : h('div', { class: cardClassName }, [
                h('span', { 'aria-hidden': 'true' }, prefix),
                h('span', { class: 'whitespace-pre-wrap' }, label)
              ])
        ])
      }

      function renderBlock(block: NotionBlock): VNodeChild {
        if (!block?.id) return null
        const baseClassName = getBlockClassName(block.id)

        switch (block.type) {
          case 'paragraph': {
            return renderBlockWithOverride(block, () => h('div', { key: block.id, class: baseClassName }, [
              block.paragraph.rich_text.length
                ? h('p', { class: 'notion-text whitespace-pre-wrap' }, [renderRichText(block.paragraph.rich_text)])
                : null,
              renderChildren(block.id)
            ]))
          }
          case 'heading_1':
          case 'heading_2':
          case 'heading_3': {
            return renderBlockWithOverride(block, () => {
              const richText = block.type === 'heading_1'
                ? block.heading_1.rich_text
                : block.type === 'heading_2'
                  ? block.heading_2.rich_text
                  : block.heading_3.rich_text
              const headingClass = cn(
                'font-semibold text-inherit scroll-mt-20',
                block.type === 'heading_1' && 'text-[2rem] leading-[1.24] mt-12 mb-3',
                block.type === 'heading_2' && 'text-[1.62rem] leading-[1.28] mt-10 mb-2',
                block.type === 'heading_3' && 'text-[1.34rem] leading-[1.34] mt-8 mb-1.5'
              )
              const content = renderRichText(richText)
              const headingTag = block.type === 'heading_1' ? 'h1' : block.type === 'heading_2' ? 'h2' : 'h3'
              return h('div', { key: block.id, id: getHeadingAnchorId(block.id), class: baseClassName }, [
                h(headingTag, { class: headingClass }, [content]),
                renderChildren(block.id)
              ])
            })
          }
          case 'quote': {
            return renderBlockWithOverride(block, () => h('div', { key: block.id, class: baseClassName }, [
              h('blockquote', {
                class: 'notion-quote border-l-4 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-r-md whitespace-pre-wrap'
              }, [renderRichText(block.quote.rich_text)]),
              renderChildren(block.id)
            ]))
          }
          case 'callout': {
            return renderBlockWithOverride(block, () => {
              const emoji = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : ''
              const iconUrl = getCalloutIconUrl(block.callout.icon || null)
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'notion-callout my-4 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-start' }, [
                  h('span', { class: 'notion-page-icon-inline flex-none' }, [
                    emoji
                      ? h('span', { 'aria-hidden': 'true' }, emoji)
                      : iconUrl
                        ? h('img', { src: iconUrl, alt: '', class: 'h-[1.05em] w-[1.05em] object-contain' })
                        : h('span', { 'aria-hidden': 'true' }, 'i')
                  ]),
                  h('div', { class: 'notion-callout-text whitespace-pre-wrap' }, [renderRichText(block.callout.rich_text)])
                ]),
                renderChildren(block.id)
              ])
            })
          }
          case 'equation': {
            return renderBlockWithOverride(block, () => {
              const expression = block.equation.expression || ''
              return h('div', { key: block.id, class: baseClassName }, [
                expression
                  ? h('div', {
                      class: 'notion-equation-block my-4 overflow-x-auto text-center',
                      innerHTML: renderEquationHtml(expression, true)
                    })
                  : null,
                renderChildren(block.id)
              ])
            })
          }
          case 'code': {
            return renderBlockWithOverride(block, () => {
              const source = getPlainTextFromRichText(block.code.rich_text)
              const language = normalizeCodeLanguage(block.code.language || '')
              if (language === 'mermaid') {
                return h('div', { key: block.id, class: baseClassName }, [
                  h(MermaidBlock, { code: source, class: 'my-4' }),
                  renderChildren(block.id)
                ])
              }
              const highlighted = model.highlightedCodeByBlockId[block.id]
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'notion-code-block my-5 overflow-hidden' }, [
                  h('span', { class: 'notion-code-language notion-code-language-floating' },
                    highlighted?.displayLanguage || `${block.code.language || ''}`.trim() || 'plain text'
                  ),
                  h('div', {
                    class: 'notion-code-content',
                    innerHTML: highlighted?.html || renderFallbackHighlightedCodeHtml(source)
                  })
                ]),
                renderChildren(block.id)
              ])
            })
          }
          case 'image': {
            return renderBlockWithOverride(block, () => {
              const source = block.image.type === 'external' ? block.image.external?.url : block.image.file?.url
              const caption = block.image.caption || []
              const captionText = getPlainTextFromRichText(caption)
              if (!source) {
                return h(Unsupported, { key: block.id, block, class: baseClassName, message: 'Unsupported image source' })
              }
              return h('figure', { key: block.id, class: cn(baseClassName, 'my-6') }, [
                h('img', { src: source, alt: captionText || 'Notion image', loading: 'lazy', class: 'w-full rounded-md' }),
                caption.length > 0
                  ? h('figcaption', { class: 'mt-2 notion-asset-caption whitespace-pre-wrap' }, [renderRichText(caption)])
                  : null,
                renderChildren(block.id)
              ])
            })
          }
          case 'column_list': {
            return renderBlockWithOverride(block, () => {
              const columns = (childrenById[block.id] || [])
                .map((id: string) => blocksById[id])
                .filter((col: NotionBlock): col is NotionColumnBlock => col?.type === 'column')
              return h('div', { key: block.id, class: baseClassName }, [
                columns.length > 0
                  ? h('div', { class: 'my-4 flex flex-col gap-4 md:flex-row' }, columns.map(renderColumnBlock))
                  : renderChildren(block.id)
              ])
            })
          }
          case 'column':
            return renderColumnBlock(block)
          case 'toggle': {
            return renderBlockWithOverride(block, () => {
              const hasChildren = (childrenById[block.id] || []).length > 0
              return h('details', {
                key: block.id,
                class: cn(baseClassName, 'nobelium-toggle callout-wrap my-3', !hasChildren && 'nobelium-toggle-empty')
              }, [
                h('summary', { class: 'nobelium-toggle-summary' }, [
                  h('span', { class: 'collapsed-label nobelium-toggle-title whitespace-pre-wrap' }, [renderRichText(block.toggle.rich_text)]),
                  h('span', { class: 'button-wrap expand-icon', 'aria-hidden': 'true' }, [
                    h('svg', { width: '24', height: '24', viewBox: '0 0 24 24', role: 'presentation' }, [
                      h('path', { d: 'M8.67383 5.36887L12.0427 2L15.4116 5.36887' }),
                      h('path', { d: 'M15.4116 18.8443L12.0427 22.2132L8.67383 18.8443' }),
                      h('path', { d: 'M12.0426 2.00003V10.0853' }),
                      h('path', { d: 'M12.0426 22.2132V14.1279' })
                    ])
                  ]),
                  h('span', { class: 'button-wrap collapse-icon', 'aria-hidden': 'true' }, [
                    h('svg', { width: '24', height: '24', viewBox: '0 0 24 24', role: 'presentation' }, [
                      h('path', { d: 'M8.67383 17.3689L12.0427 14L15.4116 17.3689' }),
                      h('path', { d: 'M15.4116 6.7164L12.0427 10.0853L8.67383 6.7164' }),
                      h('path', { d: 'M12.0426 14V22.0853' }),
                      h('path', { d: 'M12.0426 10.0853V1.99999' })
                    ])
                  ])
                ]),
                hasChildren
                  ? h('div', { class: 'nobelium-toggle-content callout-content' }, [
                      h('div', { class: 'content' }, [renderChildren(block.id)])
                    ])
                  : null
              ])
            })
          }
          case 'template': {
            return renderBlockWithOverride(block, () => h('div', { key: block.id, class: baseClassName }, [
              block.template.rich_text.length
                ? h('p', { class: 'notion-text whitespace-pre-wrap' }, [renderRichText(block.template.rich_text)])
                : null,
              renderChildren(block.id)
            ]))
          }
          case 'tab': {
            return renderBlockWithOverride(block, () => {
              const tabPanels = (childrenById[block.id] || [])
                .map((id: string) => blocksById[id])
                .filter(isParagraphBlock)
                .map((panel: NotionParagraphBlock, index: number) => ({
                  panel,
                  index,
                  childIds: childrenById[panel.id] || []
                }))
                .filter(({ childIds }) => childIds.length > 0)

              if (!tabPanels.length) return null

              return h('div', { key: block.id, class: cn(baseClassName, 'notion-tabs-block') }, tabPanels.map(({ panel, index, childIds }) => {
                const inputId = `notion-tab-${block.id.replaceAll('-', '')}-${panel.id.replaceAll('-', '')}`
                const label = getPlainTextFromRichText(panel.paragraph.rich_text).trim() || `Tab ${index + 1}`
                const emoji = panel.paragraph.icon?.type === 'emoji' ? panel.paragraph.icon.emoji || '' : ''
                const iconUrl = getCalloutIconUrl(panel.paragraph.icon || null)

                return h('div', { key: panel.id, class: 'notion-tab-item' }, [
                  h('input', {
                    id: inputId,
                    class: 'notion-tab-input',
                    type: 'radio',
                    name: `notion-tab-group-${block.id}`,
                    checked: index === 0
                  }),
                  h('label', { for: inputId, class: 'notion-tab-label' }, [
                    emoji
                      ? h('span', { class: 'notion-tab-label-icon', 'aria-hidden': 'true' }, emoji)
                      : iconUrl
                        ? h('span', { class: 'notion-tab-label-icon', 'aria-hidden': 'true' }, [
                            h('img', { src: iconUrl, alt: '', class: 'notion-tab-label-icon-image' })
                          ])
                        : null,
                    h('span', { class: 'notion-tab-label-text' }, label)
                  ]),
                  h('div', { class: 'notion-tab-panel' }, renderBlockList(childIds))
                ])
              }))
            })
          }
          case 'table_of_contents': {
            return renderBlockWithOverride(block, () =>
              model.toc.length
                ? h('nav', { key: block.id, class: cn(baseClassName, 'my-4 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2') }, [
                    h('p', { class: 'text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2' }, 'Table of contents'),
                    h('ul', { class: 'space-y-1' }, model.toc.map(item =>
                      h('li', { key: `${block.id}-${item.id}`, style: { marginLeft: `${item.indentLevel * 14}px` } }, [
                        h('a', {
                          href: `#${getHeadingAnchorId(item.id)}`,
                          class: 'text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100'
                        }, item.text)
                      ])
                    ))
                  ])
                : null
            )
          }
          case 'link_to_page': {
            return renderBlockWithOverride(block, () => {
              const targetId = `${block.link_to_page.page_id || block.link_to_page.database_id || block.link_to_page.block_id || block.link_to_page.comment_id || ''}`.trim()
              const href = model.pageHrefMap[normalizeNotionEntityId(targetId)] || buildNotionPublicUrl(targetId)
              return h('div', { key: block.id, class: baseClassName }, [
                renderPageReferenceCard(getLinkToPageLabel(block.link_to_page), href, baseClassName, '->'),
                renderChildren(block.id)
              ])
            })
          }
          case 'child_page': {
            return renderBlockWithOverride(block, () => {
              const href = model.pageHrefMap[normalizeNotionEntityId(block.id)] || buildNotionPublicUrl(block.id)
              return h('div', { key: block.id, class: baseClassName }, [
                renderPageReferenceCard(`${block.child_page.title || ''}`.trim() || 'Untitled page', href, baseClassName, 'Pg'),
                renderChildren(block.id)
              ])
            })
          }
          case 'child_database': {
            return renderBlockWithOverride(block, () => {
              const href = model.pageHrefMap[normalizeNotionEntityId(block.id)] || buildNotionPublicUrl(block.id)
              return h('div', { key: block.id, class: baseClassName }, [
                renderPageReferenceCard(`${block.child_database.title || ''}`.trim() || 'Untitled database', href, baseClassName, 'DB'),
                renderChildren(block.id)
              ])
            })
          }
          case 'synced_block': {
            return renderBlockWithOverride(block, () => {
              const syncedFrom = block.synced_block.synced_from?.block_id || ''
              const hasChildren = (childrenById[block.id] || []).length > 0
              return h('div', { key: block.id, class: baseClassName }, [
                hasChildren
                  ? renderChildren(block.id)
                  : h('div', {
                      class: 'my-3 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400'
                    }, syncedFrom ? `Synced block (${syncedFrom.slice(0, 8)}...)` : 'Synced block')
              ])
            })
          }
          case 'breadcrumb':
            return null
          case 'embed': {
            return renderBlockWithOverride(block, () => {
              const embedUrl = block.embed.url || ''
              const iframeUrl = resolveEmbedIframeUrl(embedUrl)
              const normalizedEmbedUrl = normalizeRichTextUrl(embedUrl)
              const caption = block.embed.caption || []
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'my-4' }, [
                  iframeUrl || normalizedEmbedUrl
                    ? h('div', {
                        class: 'relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700',
                        style: { paddingTop: '56.25%' }
                      }, [
                        h('iframe', {
                          src: iframeUrl || normalizedEmbedUrl,
                          title: embedUrl || block.id,
                          class: 'absolute top-0 left-0 h-full w-full',
                          allowfullscreen: true,
                          loading: 'lazy'
                        })
                      ])
                    : embedUrl
                      ? renderLinkPreviewCard(embedUrl, normalizeRichTextUrl(embedUrl))
                      : h(Unsupported, { block, class: '', message: 'Unsupported embed block' }),
                  caption.length > 0
                    ? h('div', { class: 'notion-asset-caption mt-2 whitespace-pre-wrap' }, [renderRichText(caption)])
                    : null
                ]),
                renderChildren(block.id)
              ])
            })
          }
          case 'bookmark': {
            return renderBlockWithOverride(block, () => {
              const bookmarkUrl = block.bookmark.url || ''
              const caption = block.bookmark.caption || []
              return h('div', { key: block.id, class: baseClassName }, [
                bookmarkUrl
                  ? renderLinkPreviewCard(bookmarkUrl, normalizeRichTextUrl(bookmarkUrl))
                  : h(Unsupported, { block, class: 'my-4', message: 'Unsupported bookmark block' }),
                caption.length > 0
                  ? h('div', { class: 'notion-asset-caption mt-2 whitespace-pre-wrap' }, [renderRichText(caption)])
                  : null,
                renderChildren(block.id)
              ])
            })
          }
          case 'video': {
            return renderBlockWithOverride(block, () => {
              const source = getFileBlockUrl(block.video)
              const iframeUrl = resolveEmbedIframeUrl(source)
              const caption = block.video.caption || []
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'my-4' }, [
                  !source
                    ? h(Unsupported, { block, class: '', message: 'Unsupported video block' })
                    : iframeUrl
                      ? h('div', {
                          class: 'relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700',
                          style: { paddingTop: '56.25%' }
                        }, [
                          h('iframe', { src: iframeUrl, title: source || block.id, class: 'absolute top-0 left-0 h-full w-full', allowfullscreen: true, loading: 'lazy' })
                        ])
                      : h('video', { src: source, controls: true, preload: 'metadata', class: 'w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-black' }),
                  caption.length > 0
                    ? h('div', { class: 'notion-asset-caption mt-2 whitespace-pre-wrap' }, [renderRichText(caption)])
                    : null
                ]),
                renderChildren(block.id)
              ])
            })
          }
          case 'audio': {
            return renderBlockWithOverride(block, () => {
              const source = getFileBlockUrl(block.audio)
              const caption = block.audio.caption || []
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'my-4' }, [
                  !source
                    ? h(Unsupported, { block, class: '', message: 'Unsupported audio block' })
                    : h('audio', { src: source, controls: true, preload: 'metadata', class: 'w-full' }),
                  caption.length > 0
                    ? h('div', { class: 'notion-asset-caption mt-2 whitespace-pre-wrap' }, [renderRichText(caption)])
                    : null
                ]),
                renderChildren(block.id)
              ])
            })
          }
          case 'pdf': {
            return renderBlockWithOverride(block, () => {
              const source = getFileBlockUrl(block.pdf)
              const caption = block.pdf.caption || []
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'my-4 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden' }, [
                  !source
                    ? h('div', { class: 'p-3 text-sm text-zinc-500 dark:text-zinc-400' }, 'Unsupported pdf block')
                    : [
                        h('iframe', { src: source, title: source || block.id, class: 'w-full', style: { height: '620px' }, loading: 'lazy' }),
                        h('a', {
                          href: source,
                          target: '_blank',
                          rel: 'noopener noreferrer',
                          class: 'block border-t border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline'
                        }, 'Open PDF')
                      ]
                ]),
                caption.length > 0
                  ? h('div', { class: 'notion-asset-caption mt-2 whitespace-pre-wrap' }, [renderRichText(caption)])
                  : null,
                renderChildren(block.id)
              ])
            })
          }
          case 'file': {
            return renderBlockWithOverride(block, () => {
              const fileUrl = getFileBlockUrl(block.file)
              const caption = block.file.caption || []
              return h('div', { key: block.id, class: baseClassName }, [
                !fileUrl
                  ? h(Unsupported, { block, class: 'my-4', message: 'Unsupported file block' })
                  : h('a', { href: fileUrl, target: '_blank', rel: 'noopener noreferrer', class: 'notion-file-block' }, [
                      h('span', { class: 'notion-file-icon', 'aria-hidden': 'true' }, [
                        h('svg', { viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: '1.5', role: 'presentation' }, [
                          h('path', { d: 'M6 2.75h5.5L16 7.25V16a1.75 1.75 0 0 1-1.75 1.75H6A1.75 1.75 0 0 1 4.25 16V4.5A1.75 1.75 0 0 1 6 2.75Z' }),
                          h('path', { d: 'M11.5 2.75V7.25H16' }),
                          h('path', { d: 'M7.25 11.25h5.5M7.25 14h3.5' })
                        ])
                      ]),
                      h('span', { class: 'notion-file-name' }, getFileBlockName(block.file, fileUrl))
                    ]),
                caption.length > 0
                  ? h('div', { class: 'notion-asset-caption mt-2 whitespace-pre-wrap' }, [renderRichText(caption)])
                  : null,
                renderChildren(block.id)
              ])
            })
          }
          case 'table': {
            return renderBlockWithOverride(block, () => {
              const rows = (childrenById[block.id] || []).map((id: string) => blocksById[id]).filter(isTableRowBlock)
              const widthFromSchema = Number(block.table.table_width) || 0
              const widthFromRows = rows.reduce((max: number, row: NotionTableRowBlock) => Math.max(max, row.table_row.cells.length), 0)
              const columnCount = Math.max(widthFromSchema, widthFromRows)
              if (!rows.length || !columnCount) {
                return h(Unsupported, { key: block.id, block, class: baseClassName, message: 'Unsupported table block' })
              }
              return h('div', { key: block.id, class: baseClassName }, [
                h('div', { class: 'notion-table-wrapper my-4' }, [
                  h('table', { class: 'notion-table-block' }, [
                    h('tbody', null, rows.map((row: NotionTableRowBlock, rowIndex: number) =>
                      h('tr', { key: row.id || `${block.id}-${rowIndex}` },
                        Array.from({ length: columnCount }).map((_, colIndex) => {
                          const cellRichText = row.table_row.cells[colIndex] || []
                          const isColumnHeader = !!(block as NotionTableBlock).table.has_column_header && rowIndex === 0
                          const isRowHeader = !!(block as NotionTableBlock).table.has_row_header && colIndex === 0
                          const isHeader = isColumnHeader || isRowHeader
                          return isHeader
                            ? h('th', {
                                key: `${row.id || rowIndex}-${colIndex}`,
                                class: 'notion-table-cell notion-table-cell-header',
                                scope: isColumnHeader ? 'col' : 'row'
                              }, [h('div', { class: 'whitespace-pre-wrap' }, [renderRichText(cellRichText)])])
                            : h('td', {
                                key: `${row.id || rowIndex}-${colIndex}`,
                                class: 'notion-table-cell'
                              }, [h('div', { class: 'whitespace-pre-wrap' }, [renderRichText(cellRichText)])])
                        })
                      )
                    ))
                  ])
                ]),
                renderChildren(block.id)
              ])
            })
          }
          case 'table_row':
            return null
          case 'link_preview': {
            return renderBlockWithOverride(block, () => h('div', { key: block.id, class: baseClassName }, [
              block.link_preview.url
                ? renderLinkPreviewCard(block.link_preview.url, normalizeRichTextUrl(block.link_preview.url))
                : h(Unsupported, { block, class: 'my-4', message: 'Unsupported link preview block' }),
              renderChildren(block.id)
            ]))
          }
          case 'divider': {
            return renderBlockWithOverride(block, () => h('div', { key: block.id, class: baseClassName }, [
              h('hr', { class: 'notion-hr my-4 border-zinc-200 dark:border-zinc-700' }),
              renderChildren(block.id)
            ]))
          }
          case 'bulleted_list_item':
            return renderBulletedListItem(block)
          case 'numbered_list_item':
            return renderNumberedListItem(block)
          case 'to_do':
            return renderToDoItem(block)
          case 'unsupported':
          default:
            return renderBlockWithOverride(block, () => h(Unsupported, { key: block.id, block, class: baseClassName }))
        }
      }

      function renderBlockList(blockIds: string[]): VNodeChild[] {
        const nodes: VNodeChild[] = []
        for (let index = 0; index < blockIds.length; index += 1) {
          const block = blocksById[blockIds[index]]
          if (!block) continue

          if (isBulletedListItemBlock(block)) {
            const listItems: VNodeChild[] = [renderBulletedListItem(block)]
            while (index + 1 < blockIds.length && isBulletedListItemBlock(blocksById[blockIds[index + 1]])) {
              const nextBlock = blocksById[blockIds[index + 1]]
              if (!isBulletedListItemBlock(nextBlock)) break
              listItems.push(renderBulletedListItem(nextBlock))
              index += 1
            }
            nodes.push(h('ul', { key: `bulleted-${block.id}`, class: 'notion-list list-disc my-3' }, listItems))
            continue
          }

          if (isNumberedListItemBlock(block)) {
            const listItems: VNodeChild[] = [renderNumberedListItem(block)]
            while (index + 1 < blockIds.length && isNumberedListItemBlock(blocksById[blockIds[index + 1]])) {
              const nextBlock = blocksById[blockIds[index + 1]]
              if (!isNumberedListItemBlock(nextBlock)) break
              listItems.push(renderNumberedListItem(nextBlock))
              index += 1
            }
            nodes.push(h('ol', { key: `numbered-${block.id}`, class: 'notion-list list-decimal my-3' }, listItems))
            continue
          }

          nodes.push(renderBlock(block))
        }
        return nodes
      }

      return h('div', { class: cn('notion', props.class), style: props.style }, renderBlockList(rootIds))
    }
  }
})
