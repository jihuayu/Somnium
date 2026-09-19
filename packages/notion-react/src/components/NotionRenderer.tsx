import { type ReactNode } from 'react'
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
  NotionHeading4Block,
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
  resolveEmbedIframeUrl,
  toOgProxyImageUrl
} from '../utils/notion'
import DefaultLinkPreviewCard from './LinkPreviewCard'
import DefaultMermaidBlock from './MermaidBlock'
import CodeBlock from './CodeBlock'
import ImageLightbox from './ImageLightbox'
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

function UnsupportedBlock({ block, className, message }: UnsupportedBlockProps) {
  return (
    <div className={className}>
      <div className="my-4 rounded border border-dashed border-stone-300 dark:border-stone-700 p-3 text-sm text-stone-500 dark:text-stone-400">
        {message || `Unsupported block type: ${block.type}`}
      </div>
    </div>
  )
}

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

type NotionHeadingBlock = NotionHeading1Block | NotionHeading2Block | NotionHeading3Block | NotionHeading4Block

function getHeadingPayload(block: NotionHeadingBlock) {
  switch (block.type) {
    case 'heading_1':
      return block.heading_1
    case 'heading_2':
      return block.heading_2
    case 'heading_3':
      return block.heading_3
    case 'heading_4':
      return block.heading_4
  }
}

function getHeadingTag(block: NotionHeadingBlock) {
  return block.type === 'heading_1' ? 'h1' : block.type === 'heading_2' ? 'h2' : block.type === 'heading_3' ? 'h3' : 'h4'
}

export default function NotionRenderer({ model, components, renderOptions, className, style }: NotionRendererProps) {
  const resolvedRenderOptions = resolveRenderOptions(renderOptions)
  const LinkPreviewCard = components?.leaves?.LinkPreviewCard || DefaultLinkPreviewCard
  const MermaidBlock = components?.leaves?.MermaidBlock || DefaultMermaidBlock
  const Unsupported = components?.leaves?.UnsupportedBlock || UnsupportedBlock
  const document = model.document
  const blocksById = document.blocksById || {}
  const childrenById = document.childrenById || {}
  const rootIds = document.rootIds || []

  const renderRichText = (richText = []) => (
    <RichText
      richText={richText}
      linkPreviewMap={model.linkPreviewMap}
      pageHrefMap={model.pageHrefMap}
      pagePreviewMap={model.pagePreviewMap}
      renderOptions={resolvedRenderOptions}
      components={components}
    />
  )

  const renderChildren = (blockId: string) => {
    const childIds = childrenById[blockId] || []
    if (!childIds.length) return null
    return renderBlockList(childIds)
  }

  const renderBlockWithOverride = (block: NotionBlock, fallback: () => ReactNode) => {
    const customRenderer = components?.blocks?.[block.type]
    if (!customRenderer) return fallback()

    const props: BlockRendererProps = {
      block,
      model,
      renderOptions: resolvedRenderOptions,
      renderChildren,
      renderRichText
    }
    return customRenderer(props)
  }

  const renderLinkPreviewCard = (url: string, previewKey: string, className?: string) => {
    const props: LinkPreviewCardProps = {
      url,
      className,
      preview: model.linkPreviewMap[previewKey]
    }
    return <LinkPreviewCard {...props} />
  }

  const renderBulletedListItem = (block: NotionBulletedListItemBlock) => renderBlockWithOverride(block, () => (
    <li key={block.id} className={getBlockClassName(block.id)}>
      <div className="notion-text whitespace-pre-wrap">{renderRichText(block.bulleted_list_item.rich_text)}</div>
      {renderChildren(block.id)}
    </li>
  ))

  const renderNumberedListItem = (block: NotionNumberedListItemBlock) => renderBlockWithOverride(block, () => (
    <li key={block.id} className={getBlockClassName(block.id)}>
      <div className="notion-text whitespace-pre-wrap">{renderRichText(block.numbered_list_item.rich_text)}</div>
      {renderChildren(block.id)}
    </li>
  ))

  const renderToDoItem = (block: NotionToDoBlock) => renderBlockWithOverride(block, () => {
    const checked = !!block.to_do.checked
    return (
      <div key={block.id} className={cn(getBlockClassName(block.id), 'notion-to-do-block')}>
        <div className="notion-to-do-item flex items-baseline gap-1">
          <span className="notion-property-checkbox">
            <span className={cn('notion-to-do-checkbox', checked && 'is-checked')} role="img" aria-label={checked ? 'Checked' : 'Unchecked'}>
              {checked && (
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4.5 10.5 8.3 14.3 15.5 6.8" />
                </svg>
              )}
            </span>
          </span>
          <div className="notion-to-do-body flex-1 min-w-0 whitespace-pre-wrap">{renderRichText(block.to_do.rich_text)}</div>
        </div>
        <div className="pl-7">{renderChildren(block.id)}</div>
      </div>
    )
  })

  const renderColumnBlock = (block: NotionColumnBlock) => renderBlockWithOverride(block, () => (
    <div key={block.id} className={getBlockClassName(block.id)} style={{ flex: block.column.width_ratio || 1, minWidth: 0 }}>
      {renderChildren(block.id)}
    </div>
  ))

  const renderPageReferenceCard = (label: string, href: string, className: string, prefix: string) => {
    const isInternal = href.startsWith('/')
    const cardClassName = 'inline-flex items-center gap-2 rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/40 px-3 py-1.5 text-sm text-stone-700 dark:text-stone-300'
    return (
      <div className={cn(className, 'my-3')}>
        {href
          ? (
            <a
              href={href}
              target={isInternal ? undefined : '_blank'}
              rel={isInternal ? undefined : 'noopener noreferrer'}
              className={cn(cardClassName, 'hover:border-stone-400 dark:hover:border-stone-500')}
            >
              <span aria-hidden="true">{prefix}</span>
              <span className="whitespace-pre-wrap">{label}</span>
            </a>
          )
          : (
            <div className={cardClassName}>
              <span aria-hidden="true">{prefix}</span>
              <span className="whitespace-pre-wrap">{label}</span>
            </div>
          )}
      </div>
    )
  }

  const renderBlock = (block: NotionBlock): ReactNode => {
    if (!block?.id) return null
    const baseClassName = getBlockClassName(block.id)

    switch (block.type) {
      case 'paragraph': {
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            {block.paragraph.rich_text.length ? <p className="notion-text whitespace-pre-wrap">{renderRichText(block.paragraph.rich_text)}</p> : null}
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
      case 'heading_4':
        return renderBlockWithOverride(block, () => {
          const headingPayload = getHeadingPayload(block)
          const HeadingTag = getHeadingTag(block)
          const headingClass = cn(
            'font-serif font-semibold text-inherit scroll-mt-20',
            block.type === 'heading_1' && 'text-[2rem] leading-[1.24] mt-12 mb-3',
            block.type === 'heading_2' && 'text-[1.62rem] leading-[1.28] mt-10 mb-2',
            block.type === 'heading_3' && 'text-[1.34rem] leading-[1.34] mt-8 mb-1.5',
            block.type === 'heading_4' && 'text-[1.16rem] leading-[1.4] mt-6 mb-1'
          )
          const hasChildren = (childrenById[block.id] || []).length > 0
          const content = renderRichText(headingPayload.rich_text)
          if (headingPayload.is_toggleable) {
            return (
              <details key={block.id} id={getHeadingAnchorId(block.id)} className={cn(baseClassName, 'nobelium-toggle nobelium-toggle-heading my-3', !hasChildren && 'nobelium-toggle-empty')}>
                <summary className="nobelium-toggle-summary">
                  {hasChildren && (
                    <span className="nobelium-toggle-chevron" aria-hidden="true">
                      <svg width="16" height="16" viewBox="0 0 24 24" role="presentation">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                  <HeadingTag className={cn(headingClass, 'nobelium-toggle-title whitespace-pre-wrap')}>{content}</HeadingTag>
                </summary>
                {hasChildren && <div className="nobelium-toggle-content"><div className="content">{renderChildren(block.id)}</div></div>}
              </details>
            )
          }

          return (
            <div key={block.id} id={getHeadingAnchorId(block.id)} className={baseClassName}>
              <HeadingTag className={headingClass}>{content}</HeadingTag>
              {renderChildren(block.id)}
            </div>
          )
        })
      case 'quote': {
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            <blockquote className="notion-quote border-l-4 border-stone-300 dark:border-stone-600 text-stone-700 dark:text-stone-300 rounded-r-md whitespace-pre-wrap">
              {renderRichText(block.quote.rich_text)}
            </blockquote>
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'callout': {
        return renderBlockWithOverride(block, () => {
          const emoji = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji : ''
          const iconUrl = getCalloutIconUrl(block.callout.icon || null)
          return (
            <div key={block.id} className={baseClassName}>
              <div className="notion-callout my-4 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2 flex items-start">
                <span className="notion-page-icon-inline flex-none">
                  {emoji ? <span aria-hidden="true">{emoji}</span> : iconUrl ? <img src={iconUrl} alt="" className="h-[1.05em] w-[1.05em] object-contain" /> : <span aria-hidden="true">i</span>}
                </span>
                <div className="notion-callout-text whitespace-pre-wrap">{renderRichText(block.callout.rich_text)}</div>
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'equation': {
        return renderBlockWithOverride(block, () => {
          const expression = block.equation.expression || ''
          return (
            <div key={block.id} className={baseClassName}>
              {expression
                ? <div className="notion-equation-block my-4 overflow-x-auto text-center" dangerouslySetInnerHTML={{ __html: renderEquationHtml(expression, true) }} />
                : null}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'code': {
        return renderBlockWithOverride(block, () => {
          const source = getPlainTextFromRichText(block.code.rich_text)
          const language = normalizeCodeLanguage(block.code.language || '')
          if (language === 'mermaid') {
            return (
              <div key={block.id} className={baseClassName}>
                <MermaidBlock code={source} className="my-4" />
                {renderChildren(block.id)}
              </div>
            )
          }

          const highlighted = model.highlightedCodeByBlockId[block.id]
          const codeContentId = `notion-code-content-${block.id.replaceAll('-', '')}`
          return (
            <div key={block.id} className={baseClassName}>
              <CodeBlock
                contentId={codeContentId}
                displayLanguage={highlighted?.displayLanguage || `${block.code.language || ''}`.trim() || 'plain text'}
                codeHtml={highlighted?.html || renderFallbackHighlightedCodeHtml(source)}
              />
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'image': {
        return renderBlockWithOverride(block, () => {
          const source = block.image.type === 'external' ? block.image.external?.url : block.image.file?.url
          const caption = block.image.caption || []
          const captionText = getPlainTextFromRichText(caption)
          if (!source) {
            return <Unsupported key={block.id} block={block} className={baseClassName} message="Unsupported image source" />
          }
          return (
            <figure key={block.id} className={cn(baseClassName, 'my-6')}>
              <img src={toOgProxyImageUrl(source)} alt={captionText || 'Notion image'} loading="lazy" className="w-full rounded-md border border-stone-200 dark:border-stone-800" />
              {caption.length > 0 && <figcaption className="mt-2 notion-asset-caption whitespace-pre-wrap">{renderRichText(caption)}</figcaption>}
              {renderChildren(block.id)}
            </figure>
          )
        })
      }
      case 'column_list':
        return renderBlockWithOverride(block, () => {
          const columns = (childrenById[block.id] || [])
            .map(id => blocksById[id])
            .filter((column): column is NotionColumnBlock => column?.type === 'column')
          return (
            <div key={block.id} className={baseClassName}>
              {columns.length > 0 ? <div className="my-4 flex flex-col gap-4 md:flex-row">{columns.map(renderColumnBlock)}</div> : renderChildren(block.id)}
            </div>
          )
        })
      case 'column':
        return renderColumnBlock(block)
      case 'toggle': {
        return renderBlockWithOverride(block, () => {
          const hasChildren = (childrenById[block.id] || []).length > 0
          return (
            <details key={block.id} className={cn(baseClassName, 'nobelium-toggle my-2', !hasChildren && 'nobelium-toggle-empty')}>
              <summary className="nobelium-toggle-summary">
                {hasChildren && (
                  <span className="nobelium-toggle-chevron" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" role="presentation">
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </span>
                )}
                <span className="nobelium-toggle-title whitespace-pre-wrap">{renderRichText(block.toggle.rich_text)}</span>
              </summary>
              {hasChildren && <div className="nobelium-toggle-content"><div className="content">{renderChildren(block.id)}</div></div>}
            </details>
          )
        })
      }
      case 'template': {
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            {block.template.rich_text.length ? <p className="notion-text whitespace-pre-wrap">{renderRichText(block.template.rich_text)}</p> : null}
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'tab': {
        return renderBlockWithOverride(block, () => {
          const tabPanels = (childrenById[block.id] || [])
            .map(id => blocksById[id])
            .filter(isParagraphBlock)
            .map((panel, index) => ({
              panel,
              index,
              childIds: childrenById[panel.id] || []
            }))
            .filter(({ childIds }) => childIds.length > 0)

          if (!tabPanels.length) return null

          return (
            <div key={block.id} className={cn(baseClassName, 'notion-tabs-block')}>
              {tabPanels.map(({ panel, index, childIds }) => {
                const inputId = `notion-tab-${block.id.replaceAll('-', '')}-${panel.id.replaceAll('-', '')}`
                const label = getPlainTextFromRichText(panel.paragraph.rich_text).trim() || `Tab ${index + 1}`
                const emoji = panel.paragraph.icon?.type === 'emoji' ? panel.paragraph.icon.emoji || '' : ''
                const iconUrl = getCalloutIconUrl(panel.paragraph.icon || null)

                return (
                  <div key={panel.id} className="notion-tab-item">
                    <input
                      id={inputId}
                      className="notion-tab-input"
                      type="radio"
                      name={`notion-tab-group-${block.id}`}
                      defaultChecked={index === 0}
                    />
                    <label htmlFor={inputId} className="notion-tab-label">
                      {emoji
                        ? <span className="notion-tab-label-icon" aria-hidden="true">{emoji}</span>
                        : iconUrl
                          ? (
                            <span className="notion-tab-label-icon" aria-hidden="true">
                              <img src={iconUrl} alt="" className="notion-tab-label-icon-image" />
                            </span>
                            )
                          : null}
                      <span className="notion-tab-label-text">{label}</span>
                    </label>
                    <div className="notion-tab-panel">
                      {renderBlockList(childIds)}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })
      }
      case 'table_of_contents':
        return renderBlockWithOverride(block, () => (
          model.toc.length
            ? (
              <nav key={block.id} className={cn(baseClassName, 'my-4 rounded-md border border-stone-200 dark:border-stone-700 px-3 py-2')}>
                <p className="text-xs uppercase tracking-wide text-stone-500 dark:text-stone-400 mb-2">Table of contents</p>
                <ul className="space-y-1">
                  {model.toc.map(item => (
                    <li key={`${block.id}-${item.id}`} style={{ marginLeft: `${item.indentLevel * 14}px` }}>
                      <a href={`#${getHeadingAnchorId(item.id)}`} className="text-sm text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )
            : null
        ))
      case 'link_to_page': {
        return renderBlockWithOverride(block, () => {
          const targetId = `${block.link_to_page.page_id || block.link_to_page.database_id || block.link_to_page.block_id || block.link_to_page.comment_id || ''}`.trim()
          const href = model.pageHrefMap[normalizeNotionEntityId(targetId)] || buildNotionPublicUrl(targetId)
          return (
            <div key={block.id} className={baseClassName}>
              {renderPageReferenceCard(getLinkToPageLabel(block.link_to_page), href, baseClassName, '->')}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'child_page': {
        return renderBlockWithOverride(block, () => {
          const href = model.pageHrefMap[normalizeNotionEntityId(block.id)] || buildNotionPublicUrl(block.id)
          return (
            <div key={block.id} className={baseClassName}>
              {renderPageReferenceCard(`${block.child_page.title || ''}`.trim() || 'Untitled page', href, baseClassName, 'Pg')}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'child_database': {
        return renderBlockWithOverride(block, () => {
          const href = model.pageHrefMap[normalizeNotionEntityId(block.id)] || buildNotionPublicUrl(block.id)
          return (
            <div key={block.id} className={baseClassName}>
              {renderPageReferenceCard(`${block.child_database.title || ''}`.trim() || 'Untitled database', href, baseClassName, 'DB')}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'synced_block': {
        return renderBlockWithOverride(block, () => {
          const syncedFrom = block.synced_block.synced_from?.block_id || ''
          const hasChildren = (childrenById[block.id] || []).length > 0
          return (
            <div key={block.id} className={baseClassName}>
              {hasChildren
                ? renderChildren(block.id)
                : <div className="my-3 rounded border border-dashed border-stone-300 dark:border-stone-700 p-3 text-sm text-stone-500 dark:text-stone-400">{syncedFrom ? `Synced block (${syncedFrom.slice(0, 8)}...)` : 'Synced block'}</div>}
            </div>
          )
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
          let embedHostname = ''
          try { if (embedUrl) embedHostname = new URL(embedUrl).hostname.replace(/^www\./i, '') } catch { embedHostname = '' }
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4">
                {iframeUrl || normalizedEmbedUrl
                  ? (
                    <div className="notion-embed-frame overflow-hidden rounded-md border border-stone-200 dark:border-stone-800 bg-stone-100 dark:bg-stone-800">
                      {embedHostname && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-stone-400 dark:text-stone-500 border-b border-stone-200 dark:border-stone-800">
                          <span className="inline-block h-2.5 w-2.5 rounded-full bg-stone-300 dark:bg-stone-600" />
                          <span className="truncate">{embedHostname}</span>
                        </div>
                      )}
                      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                        <iframe
                          src={iframeUrl || normalizedEmbedUrl}
                          title={embedUrl || block.id}
                          className="absolute top-0 left-0 h-full w-full"
                          allowFullScreen
                          loading="lazy"
                        />
                      </div>
                    </div>
                  )
                  : embedUrl
                    ? renderLinkPreviewCard(embedUrl, normalizeRichTextUrl(embedUrl))
                    : <Unsupported block={block} className="" message="Unsupported embed block" />}
                {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'bookmark': {
        return renderBlockWithOverride(block, () => {
          const bookmarkUrl = block.bookmark.url || ''
          const caption = block.bookmark.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              {bookmarkUrl ? renderLinkPreviewCard(bookmarkUrl, normalizeRichTextUrl(bookmarkUrl)) : <Unsupported block={block} className="my-4" message="Unsupported bookmark block" />}
              {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'video': {
        return renderBlockWithOverride(block, () => {
          const source = getFileBlockUrl(block.video)
          const iframeUrl = resolveEmbedIframeUrl(source)
          const caption = block.video.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4">
                {!source
                  ? <Unsupported block={block} className="" message="Unsupported video block" />
                  : iframeUrl
                    ? (
                      <div className="relative w-full overflow-hidden rounded-md border border-stone-200 dark:border-stone-700" style={{ paddingTop: '56.25%' }}>
                        <iframe src={iframeUrl} title={source || block.id} className="absolute top-0 left-0 h-full w-full" allowFullScreen loading="lazy" />
                      </div>
                    )
                    : <video src={source} controls preload="metadata" className="w-full rounded-md border border-stone-200 dark:border-stone-700 bg-black" />}
                {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'audio': {
        return renderBlockWithOverride(block, () => {
          const source = getFileBlockUrl(block.audio)
          const caption = block.audio.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4">
                {!source ? <Unsupported block={block} className="" message="Unsupported audio block" /> : <audio src={source} controls preload="metadata" className="notion-audio-block" />}
                {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'pdf': {
        return renderBlockWithOverride(block, () => {
          const source = getFileBlockUrl(block.pdf)
          const caption = block.pdf.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4 rounded-md border border-stone-200 dark:border-stone-700 overflow-hidden">
                {!source
                  ? <div className="p-3 text-sm text-stone-500 dark:text-stone-400">Unsupported pdf block</div>
                  : (
                    <>
                      <iframe src={source} title={source || block.id} className="w-full" style={{ height: '620px' }} loading="lazy" />
                      <a href={source} target="_blank" rel="noopener noreferrer" className="block border-t border-stone-200 dark:border-stone-700 px-3 py-2 text-sm text-stone-600 dark:text-stone-400 hover:underline">
                        Open PDF
                      </a>
                    </>
                  )}
              </div>
              {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'file': {
        return renderBlockWithOverride(block, () => {
          const fileUrl = getFileBlockUrl(block.file)
          const caption = block.file.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              {!fileUrl
                ? <Unsupported block={block} className="my-4" message="Unsupported file block" />
                : (
                  <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="notion-file-block">
                    <span className="notion-file-icon" aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" role="presentation">
                        <path d="M6 2.75h5.5L16 7.25V16a1.75 1.75 0 0 1-1.75 1.75H6A1.75 1.75 0 0 1 4.25 16V4.5A1.75 1.75 0 0 1 6 2.75Z" />
                        <path d="M11.5 2.75V7.25H16" />
                        <path d="M7.25 11.25h5.5M7.25 14h3.5" />
                      </svg>
                    </span>
                    <span className="notion-file-name">{getFileBlockName(block.file, fileUrl)}</span>
                  </a>
                )}
              {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'table': {
        return renderBlockWithOverride(block, () => {
          const rows = (childrenById[block.id] || []).map(id => blocksById[id]).filter(isTableRowBlock)
          const widthFromSchema = Number(block.table.table_width) || 0
          const widthFromRows = rows.reduce((max, row) => Math.max(max, row.table_row.cells.length), 0)
          const columnCount = Math.max(widthFromSchema, widthFromRows)
          if (!rows.length || !columnCount) return <Unsupported key={block.id} block={block} className={baseClassName} message="Unsupported table block" />

          return (
            <div key={block.id} className={baseClassName}>
              <div className="notion-table-wrapper my-4">
                <table className="notion-table-block">
                  <tbody>
                    {rows.map((row, rowIndex) => (
                      <tr key={row.id || `${block.id}-${rowIndex}`}>
                        {Array.from({ length: columnCount }).map((_, colIndex) => {
                          const cellRichText = row.table_row.cells[colIndex] || []
                          const isColumnHeader = !!block.table.has_column_header && rowIndex === 0
                          const isRowHeader = !!block.table.has_row_header && colIndex === 0
                          const isHeader = isColumnHeader || isRowHeader
                          return isHeader
                            ? (
                              <th key={`${row.id || rowIndex}-${colIndex}`} className="notion-table-cell notion-table-cell-header" scope={isColumnHeader ? 'col' : 'row'}>
                                <div className="whitespace-pre-wrap">{renderRichText(cellRichText)}</div>
                              </th>
                            )
                            : (
                              <td key={`${row.id || rowIndex}-${colIndex}`} className="notion-table-cell">
                                <div className="whitespace-pre-wrap">{renderRichText(cellRichText)}</div>
                              </td>
                            )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'table_row':
        return null
      case 'link_preview': {
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            {block.link_preview.url
              ? renderLinkPreviewCard(block.link_preview.url, normalizeRichTextUrl(block.link_preview.url))
              : <Unsupported block={block} className="my-4" message="Unsupported link preview block" />}
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'divider':
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            <hr className="notion-hr my-4 border-stone-200 dark:border-stone-700" />
            {renderChildren(block.id)}
          </div>
        ))
      case 'bulleted_list_item':
        return renderBulletedListItem(block)
      case 'numbered_list_item':
        return renderNumberedListItem(block)
      case 'to_do':
        return renderToDoItem(block)
      case 'unsupported':
      default:
        return renderBlockWithOverride(block, () => <Unsupported key={block.id} block={block} className={baseClassName} />)
    }
  }

  const renderBlockList = (blockIds: string[]) => {
    const nodes: ReactNode[] = []
    for (let index = 0; index < blockIds.length; index += 1) {
      const block = blocksById[blockIds[index]]
      if (!block) continue

      if (isBulletedListItemBlock(block)) {
        const listItems = [renderBulletedListItem(block)]
        while (index + 1 < blockIds.length && isBulletedListItemBlock(blocksById[blockIds[index + 1]])) {
          const nextBlock = blocksById[blockIds[index + 1]]
          if (!isBulletedListItemBlock(nextBlock)) break
          listItems.push(renderBulletedListItem(nextBlock))
          index += 1
        }
        nodes.push(<ul key={`bulleted-${block.id}`} className="notion-list list-disc my-3">{listItems}</ul>)
        continue
      }

      if (isNumberedListItemBlock(block)) {
        const listItems = [renderNumberedListItem(block)]
        while (index + 1 < blockIds.length && isNumberedListItemBlock(blocksById[blockIds[index + 1]])) {
          const nextBlock = blocksById[blockIds[index + 1]]
          if (!isNumberedListItemBlock(nextBlock)) break
          listItems.push(renderNumberedListItem(nextBlock))
          index += 1
        }
        nodes.push(<ol key={`numbered-${block.id}`} className="notion-list list-decimal my-3">{listItems}</ol>)
        continue
      }

      nodes.push(renderBlock(block))
    }
    return nodes
  }

  return (
    <div className={cn('notion', className)} style={style}>
      {renderBlockList(rootIds)}
      <ImageLightbox />
    </div>
  )
}
