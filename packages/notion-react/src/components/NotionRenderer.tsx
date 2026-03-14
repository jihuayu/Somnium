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

function UnsupportedBlock({ block, className, message }: UnsupportedBlockProps) {
  return (
    <div className={className}>
      <div className="my-4 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
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
    const customRenderer = components?.blocks?.[block.type as NotionBlockType] as BlockRenderer | undefined
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
      <div className="notion-text whitespace-pre-wrap">{renderRichText(block.bulleted_list_item?.rich_text || [])}</div>
      {renderChildren(block.id)}
    </li>
  ))

  const renderNumberedListItem = (block: NotionNumberedListItemBlock) => renderBlockWithOverride(block, () => (
    <li key={block.id} className={getBlockClassName(block.id)}>
      <div className="notion-text whitespace-pre-wrap">{renderRichText(block.numbered_list_item?.rich_text || [])}</div>
      {renderChildren(block.id)}
    </li>
  ))

  const renderToDoItem = (block: NotionToDoBlock) => renderBlockWithOverride(block, () => {
    const checked = !!block.to_do?.checked
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
          <div className="notion-to-do-body flex-1 min-w-0 whitespace-pre-wrap">{renderRichText(block.to_do?.rich_text || [])}</div>
        </div>
        <div className="pl-7">{renderChildren(block.id)}</div>
      </div>
    )
  })

  const renderColumnBlock = (block: NotionColumnBlock) => renderBlockWithOverride(block, () => (
    <div key={block.id} className={getBlockClassName(block.id)} style={{ flex: block.column?.width_ratio || 1, minWidth: 0 }}>
      {renderChildren(block.id)}
    </div>
  ))

  const renderPageReferenceCard = (label: string, href: string, className: string, prefix: string) => {
    const isInternal = href.startsWith('/')
    const cardClassName = 'inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300'
    return (
      <div className={cn(className, 'my-3')}>
        {href
          ? (
            <a
              href={href}
              target={isInternal ? undefined : '_blank'}
              rel={isInternal ? undefined : 'noopener noreferrer'}
              className={cn(cardClassName, 'hover:border-zinc-400 dark:hover:border-zinc-500')}
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
        const paragraphBlock = block as NotionParagraphBlock
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            {paragraphBlock.paragraph?.rich_text?.length ? <p className="notion-text whitespace-pre-wrap">{renderRichText(paragraphBlock.paragraph.rich_text)}</p> : null}
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'heading_1':
      case 'heading_2':
      case 'heading_3':
        return renderBlockWithOverride(block, () => {
          const richText = block.type === 'heading_1'
            ? (block as NotionHeading1Block).heading_1?.rich_text || []
            : block.type === 'heading_2'
              ? (block as NotionHeading2Block).heading_2?.rich_text || []
              : (block as NotionHeading3Block).heading_3?.rich_text || []
          const headingClass = cn(
            'font-semibold text-inherit scroll-mt-20',
            block.type === 'heading_1' && 'text-[2rem] leading-[1.24] mt-12 mb-3',
            block.type === 'heading_2' && 'text-[1.62rem] leading-[1.28] mt-10 mb-2',
            block.type === 'heading_3' && 'text-[1.34rem] leading-[1.34] mt-8 mb-1.5'
          )
          const content = renderRichText(richText)
          return (
            <div key={block.id} id={getHeadingAnchorId(block.id)} className={baseClassName}>
              {block.type === 'heading_1' && <h1 className={headingClass}>{content}</h1>}
              {block.type === 'heading_2' && <h2 className={headingClass}>{content}</h2>}
              {block.type === 'heading_3' && <h3 className={headingClass}>{content}</h3>}
              {renderChildren(block.id)}
            </div>
          )
        })
      case 'quote': {
        const quoteBlock = block as NotionQuoteBlock
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            <blockquote className="notion-quote border-l-4 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-r-md whitespace-pre-wrap">
              {renderRichText(quoteBlock.quote?.rich_text || [])}
            </blockquote>
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'callout': {
        const calloutBlock = block as NotionCalloutBlock
        return renderBlockWithOverride(block, () => {
          const emoji = calloutBlock.callout?.icon?.type === 'emoji' ? calloutBlock.callout.icon.emoji : ''
          const iconUrl = getCalloutIconUrl(calloutBlock.callout?.icon || null)
          return (
            <div key={block.id} className={baseClassName}>
              <div className="notion-callout my-4 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex items-start">
                <span className="notion-page-icon-inline flex-none">
                  {emoji ? <span aria-hidden="true">{emoji}</span> : iconUrl ? <img src={iconUrl} alt="" className="h-[1.05em] w-[1.05em] object-contain" /> : <span aria-hidden="true">i</span>}
                </span>
                <div className="notion-callout-text whitespace-pre-wrap">{renderRichText(calloutBlock.callout?.rich_text || [])}</div>
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'equation': {
        const equationBlock = block as NotionEquationBlock
        return renderBlockWithOverride(block, () => {
          const expression = equationBlock.equation?.expression || ''
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
        const codeBlock = block as NotionCodeBlock
        return renderBlockWithOverride(block, () => {
          const source = getPlainTextFromRichText(codeBlock.code?.rich_text || [])
          const language = normalizeCodeLanguage(codeBlock.code?.language || '')
          if (language === 'mermaid') {
            return (
              <div key={block.id} className={baseClassName}>
                <MermaidBlock code={source} className="my-4" />
                {renderChildren(block.id)}
              </div>
            )
          }

          const highlighted = model.highlightedCodeByBlockId[block.id]
          return (
            <div key={block.id} className={baseClassName}>
              <div className="notion-code-block my-5 overflow-hidden">
                <span className="notion-code-language notion-code-language-floating">
                  {highlighted?.displayLanguage || `${codeBlock.code?.language || ''}`.trim() || 'plain text'}
                </span>
                <div
                  className="notion-code-content"
                  dangerouslySetInnerHTML={{ __html: highlighted?.html || renderFallbackHighlightedCodeHtml(source) }}
                />
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'image': {
        const imageBlock = block as NotionImageBlock
        return renderBlockWithOverride(block, () => {
          const source = imageBlock.image?.type === 'external' ? imageBlock.image.external?.url : imageBlock.image?.file?.url
          const caption = imageBlock.image?.caption || []
          const captionText = getPlainTextFromRichText(caption)
          if (!source) {
            return <Unsupported key={block.id} block={block} className={baseClassName} message="Unsupported image source" />
          }
          return (
            <figure key={block.id} className={cn(baseClassName, 'my-6')}>
              <img src={source} alt={captionText || 'Notion image'} loading="lazy" className="w-full rounded-md" />
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
        return renderColumnBlock(block as NotionColumnBlock)
      case 'toggle': {
        const toggleBlock = block as NotionToggleBlock
        return renderBlockWithOverride(block, () => {
          const hasChildren = (childrenById[block.id] || []).length > 0
          return (
            <details key={block.id} className={cn(baseClassName, 'nobelium-toggle callout-wrap my-3', !hasChildren && 'nobelium-toggle-empty')}>
              <summary className="nobelium-toggle-summary">
                <span className="collapsed-label nobelium-toggle-title whitespace-pre-wrap">{renderRichText(toggleBlock.toggle?.rich_text || [])}</span>
                <span className="button-wrap expand-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" role="presentation">
                    <path d="M8.67383 5.36887L12.0427 2L15.4116 5.36887" />
                    <path d="M15.4116 18.8443L12.0427 22.2132L8.67383 18.8443" />
                    <path d="M12.0426 2.00003V10.0853" />
                    <path d="M12.0426 22.2132V14.1279" />
                  </svg>
                </span>
                <span className="button-wrap collapse-icon" aria-hidden="true">
                  <svg width="24" height="24" viewBox="0 0 24 24" role="presentation">
                    <path d="M8.67383 17.3689L12.0427 14L15.4116 17.3689" />
                    <path d="M15.4116 6.7164L12.0427 10.0853L8.67383 6.7164" />
                    <path d="M12.0426 14V22.0853" />
                    <path d="M12.0426 10.0853V1.99999" />
                  </svg>
                </span>
              </summary>
              {hasChildren && <div className="nobelium-toggle-content callout-content"><div className="content">{renderChildren(block.id)}</div></div>}
            </details>
          )
        })
      }
      case 'template': {
        const templateBlock = block as NotionTemplateBlock
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            {templateBlock.template?.rich_text?.length ? <p className="notion-text whitespace-pre-wrap">{renderRichText(templateBlock.template.rich_text)}</p> : null}
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'table_of_contents':
        return renderBlockWithOverride(block, () => (
          model.toc.length
            ? (
              <nav key={block.id} className={cn(baseClassName, 'my-4 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2')}>
                <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Table of contents</p>
                <ul className="space-y-1">
                  {model.toc.map(item => (
                    <li key={`${block.id}-${item.id}`} style={{ marginLeft: `${item.indentLevel * 14}px` }}>
                      <a href={`#${getHeadingAnchorId(item.id)}`} className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100">
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
        const linkToPageBlock = block as NotionLinkToPageBlock
        return renderBlockWithOverride(block, () => {
          const targetId = `${linkToPageBlock.link_to_page?.page_id || linkToPageBlock.link_to_page?.database_id || linkToPageBlock.link_to_page?.block_id || linkToPageBlock.link_to_page?.comment_id || ''}`.trim()
          const href = model.pageHrefMap[normalizeNotionEntityId(targetId)] || buildNotionPublicUrl(targetId)
          return (
            <div key={block.id} className={baseClassName}>
              {renderPageReferenceCard(getLinkToPageLabel(linkToPageBlock.link_to_page), href, baseClassName, '->')}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'child_page': {
        const childPageBlock = block as NotionChildPageBlock
        return renderBlockWithOverride(block, () => {
          const href = model.pageHrefMap[normalizeNotionEntityId(block.id)] || buildNotionPublicUrl(block.id)
          return (
            <div key={block.id} className={baseClassName}>
              {renderPageReferenceCard(`${childPageBlock.child_page?.title || ''}`.trim() || 'Untitled page', href, baseClassName, 'Pg')}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'child_database': {
        const childDatabaseBlock = block as NotionChildDatabaseBlock
        return renderBlockWithOverride(block, () => {
          const href = model.pageHrefMap[normalizeNotionEntityId(block.id)] || buildNotionPublicUrl(block.id)
          return (
            <div key={block.id} className={baseClassName}>
              {renderPageReferenceCard(`${childDatabaseBlock.child_database?.title || ''}`.trim() || 'Untitled database', href, baseClassName, 'DB')}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'synced_block': {
        const syncedBlock = block as NotionSyncedBlock
        return renderBlockWithOverride(block, () => {
          const syncedFrom = syncedBlock.synced_block?.synced_from?.block_id || ''
          const hasChildren = (childrenById[block.id] || []).length > 0
          return (
            <div key={block.id} className={baseClassName}>
              {hasChildren
                ? renderChildren(block.id)
                : <div className="my-3 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">{syncedFrom ? `Synced block (${syncedFrom.slice(0, 8)}...)` : 'Synced block'}</div>}
            </div>
          )
        })
      }
      case 'breadcrumb':
        return null
      case 'embed': {
        const embedBlock = block as NotionEmbedBlock
        return renderBlockWithOverride(block, () => {
          const embedUrl = embedBlock.embed?.url || ''
          const iframeUrl = resolveEmbedIframeUrl(embedUrl)
          const normalizedEmbedUrl = normalizeRichTextUrl(embedUrl)
          const caption = embedBlock.embed?.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4">
                {iframeUrl || normalizedEmbedUrl
                  ? (
                    <div className="relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700" style={{ paddingTop: '56.25%' }}>
                      <iframe
                        src={iframeUrl || normalizedEmbedUrl}
                        title={embedUrl || block.id}
                        className="absolute top-0 left-0 h-full w-full"
                        allowFullScreen
                        loading="lazy"
                      />
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
        const bookmarkBlock = block as NotionBookmarkBlock
        return renderBlockWithOverride(block, () => {
          const bookmarkUrl = bookmarkBlock.bookmark?.url || ''
          const caption = bookmarkBlock.bookmark?.caption || []
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
        const videoBlock = block as NotionVideoBlock
        return renderBlockWithOverride(block, () => {
          const source = getFileBlockUrl(videoBlock.video)
          const iframeUrl = resolveEmbedIframeUrl(source)
          const caption = videoBlock.video?.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4">
                {!source
                  ? <Unsupported block={block} className="" message="Unsupported video block" />
                  : iframeUrl
                    ? (
                      <div className="relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700" style={{ paddingTop: '56.25%' }}>
                        <iframe src={iframeUrl} title={source || block.id} className="absolute top-0 left-0 h-full w-full" allowFullScreen loading="lazy" />
                      </div>
                    )
                    : <video src={source} controls preload="metadata" className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-black" />}
                {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'audio': {
        const audioBlock = block as NotionAudioBlock
        return renderBlockWithOverride(block, () => {
          const source = getFileBlockUrl(audioBlock.audio)
          const caption = audioBlock.audio?.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4">
                {!source ? <Unsupported block={block} className="" message="Unsupported audio block" /> : <audio src={source} controls preload="metadata" className="w-full" />}
                {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              </div>
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'pdf': {
        const pdfBlock = block as NotionPdfBlock
        return renderBlockWithOverride(block, () => {
          const source = getFileBlockUrl(pdfBlock.pdf)
          const caption = pdfBlock.pdf?.caption || []
          return (
            <div key={block.id} className={baseClassName}>
              <div className="my-4 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                {!source
                  ? <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400">Unsupported pdf block</div>
                  : (
                    <>
                      <iframe src={source} title={source || block.id} className="w-full" style={{ height: '620px' }} loading="lazy" />
                      <a href={source} target="_blank" rel="noopener noreferrer" className="block border-t border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline">
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
        const fileBlock = block as NotionFileBlock
        return renderBlockWithOverride(block, () => {
          const fileUrl = getFileBlockUrl(fileBlock.file)
          const caption = fileBlock.file?.caption || []
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
                    <span className="notion-file-name">{getFileBlockName(fileBlock.file, fileUrl)}</span>
                  </a>
                )}
              {caption.length > 0 && <div className="notion-asset-caption mt-2 whitespace-pre-wrap">{renderRichText(caption)}</div>}
              {renderChildren(block.id)}
            </div>
          )
        })
      }
      case 'table': {
        const tableBlock = block as NotionTableBlock
        return renderBlockWithOverride(block, () => {
          const rows = (childrenById[block.id] || []).map(id => blocksById[id]).filter(isTableRowBlock)
          const widthFromSchema = Number(tableBlock.table?.table_width) || 0
          const widthFromRows = rows.reduce((max, row) => Math.max(max, row.table_row?.cells?.length || 0), 0)
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
                          const cellRichText = row.table_row?.cells?.[colIndex] || []
                          const isColumnHeader = !!tableBlock.table?.has_column_header && rowIndex === 0
                          const isRowHeader = !!tableBlock.table?.has_row_header && colIndex === 0
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
        const linkPreviewBlock = block as NotionLinkPreviewBlock
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            {linkPreviewBlock.link_preview?.url
              ? renderLinkPreviewCard(linkPreviewBlock.link_preview.url, normalizeRichTextUrl(linkPreviewBlock.link_preview.url))
              : <Unsupported block={block} className="my-4" message="Unsupported link preview block" />}
            {renderChildren(block.id)}
          </div>
        ))
      }
      case 'divider':
        return renderBlockWithOverride(block, () => (
          <div key={block.id} className={baseClassName}>
            <hr className="notion-hr my-4 border-zinc-200 dark:border-zinc-700" />
            {renderChildren(block.id)}
          </div>
        ))
      case 'bulleted_list_item':
        return renderBulletedListItem(block as NotionBulletedListItemBlock)
      case 'numbered_list_item':
        return renderNumberedListItem(block as NotionNumberedListItemBlock)
      case 'to_do':
        return renderToDoItem(block as NotionToDoBlock)
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
          listItems.push(renderBulletedListItem(blocksById[blockIds[index + 1]] as NotionBulletedListItemBlock))
          index += 1
        }
        nodes.push(<ul key={`bulleted-${block.id}`} className="notion-list list-disc my-3">{listItems}</ul>)
        continue
      }

      if (isNumberedListItemBlock(block)) {
        const listItems = [renderNumberedListItem(block)]
        while (index + 1 < blockIds.length && isNumberedListItemBlock(blocksById[blockIds[index + 1]])) {
          listItems.push(renderNumberedListItem(blocksById[blockIds[index + 1]] as NotionNumberedListItemBlock))
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
    </div>
  )
}
