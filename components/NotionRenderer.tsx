import { Suspense } from 'react'
import cn from 'classnames'
import katex from 'katex'
import { createHash } from 'node:crypto'
import { FONTS_MISANS } from '@/consts'
import { resolveEmbedIframeUrl } from '@/lib/notion/embed'
import { buildNotionPublicUrl, resolvePageHref } from '@/lib/notion/pageLinkMap'
import LinkPreviewCard, { LinkPreviewCardFallback } from '@/components/LinkPreviewCard'
import MermaidBlock from '@/components/MermaidBlock'
import { RichText, getPlainTextFromRichText, normalizeRichTextUrl } from '@/components/notion/RichText'
import type { LinkPreviewMap } from '@/lib/link-preview/types'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'
import type { PageLinkMap } from '@/lib/notion/pageLinkMap'
import { highlightCodeToHtml, normalizeCodeLanguage, type HighlightedCode } from '@/lib/server/shiki'
import { mapWithConcurrency } from '@/lib/utils/promisePool'

function escapeHtml(input: string): string {
  return `${input || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getBlockClassName(blockId: string): string {
  return `notion-block-${blockId.replaceAll('-', '')}`
}

function getHeadingAnchorId(blockId: string): string {
  return `notion-heading-${blockId.replaceAll('-', '')}`
}

function parseUrl(url: string | null): URL | null {
  if (!url) return null
  try { return new URL(url) } catch { return null }
}

function decodePathSegment(segment: string): string {
  if (!segment) return ''
  try { return decodeURIComponent(segment) } catch { return segment }
}

function getFileBlockUrl(filePayload: any): string {
  if (!filePayload || typeof filePayload !== 'object') return ''
  if (filePayload.type === 'external') return filePayload?.external?.url || ''
  if (filePayload.type === 'file') return filePayload?.file?.url || ''
  return filePayload?.external?.url || filePayload?.file?.url || ''
}

function getFileBlockName(filePayload: any, fileUrl: string): string {
  const explicitName = `${filePayload?.name || ''}`.trim()
  if (explicitName) return explicitName

  const parsed = parseUrl(fileUrl)
  if (!parsed) return 'File'

  const filename = decodePathSegment(parsed.pathname.split('/').filter(Boolean).pop() || '')
  if (filename) return filename

  return parsed.hostname || 'File'
}

function renderEquationHtml(expression: string, displayMode = false): string {
  if (!expression) return ''
  try {
    return katex.renderToString(expression, {
      displayMode,
      throwOnError: false,
      strict: 'ignore'
    })
  } catch {
    return escapeHtml(expression)
  }
}

function getCalloutIconUrl(icon: any): string {
  if (!icon || typeof icon !== 'object') return ''
  if (icon.type === 'external') return icon?.external?.url || ''
  if (icon.type === 'file') return icon?.file?.url || ''
  return ''
}

function getLinkToPageLabel(linkToPage: any): string {
  if (!linkToPage || typeof linkToPage !== 'object') return 'Linked page'
  const linkType = `${linkToPage.type || ''}`
  switch (linkType) {
    case 'page_id':
      return 'Linked page'
    case 'database_id':
      return 'Linked database'
    case 'block_id':
      return 'Linked block'
    case 'comment_id':
      return 'Linked comment'
    default:
      return 'Linked page'
  }
}

type HighlightedCodeByBlockId = Record<string, HighlightedCode>
const HIGHLIGHT_CODE_CONCURRENCY = 4
const HIGHLIGHTED_PAGE_CACHE_MAX_ENTRIES = 96
const highlightedCodePageCache = new Map<string, HighlightedCodeByBlockId>()

function buildHighlightedPageCacheKey(pageId: string, blocksById: Record<string, any>): string {
  const hash = createHash('sha1')
  hash.update(pageId || '')

  for (const block of Object.values(blocksById || {})) {
    if (!block || block.type !== 'code') continue
    const source = getPlainTextFromRichText(block?.code?.rich_text || [])
    const rawLanguage = `${block?.code?.language || ''}`.trim().toLowerCase()
    hash.update(`${block.id || ''}\u0000${rawLanguage}\u0000${source}\u0000`)
  }

  return hash.digest('hex')
}

function readHighlightedPageCache(cacheKey: string): HighlightedCodeByBlockId | null {
  const value = highlightedCodePageCache.get(cacheKey)
  if (!value) return null

  highlightedCodePageCache.delete(cacheKey)
  highlightedCodePageCache.set(cacheKey, value)
  return value
}

function writeHighlightedPageCache(cacheKey: string, value: HighlightedCodeByBlockId) {
  if (highlightedCodePageCache.size >= HIGHLIGHTED_PAGE_CACHE_MAX_ENTRIES) {
    const oldestKey = highlightedCodePageCache.keys().next().value
    if (typeof oldestKey === 'string' && oldestKey) {
      highlightedCodePageCache.delete(oldestKey)
    }
  }
  highlightedCodePageCache.set(cacheKey, value)
}

async function buildHighlightedCodeMap(pageId: string, blocksById: Record<string, any>): Promise<HighlightedCodeByBlockId> {
  const codeBlocks = Object.values(blocksById || {}).filter((block: any) => {
    if (!block || block.type !== 'code') return false
    const rawLanguage = `${block?.code?.language || ''}`
    return normalizeCodeLanguage(rawLanguage) !== 'mermaid'
  })

  if (!codeBlocks.length) return {}

  const cacheKey = buildHighlightedPageCacheKey(pageId, blocksById)
  const cached = readHighlightedPageCache(cacheKey)
  if (cached) return cached

  const uniquePairs = new Map<string, { source: string, language: string }>()
  for (const block of codeBlocks) {
    const source = getPlainTextFromRichText(block?.code?.rich_text || [])
    const language = `${block?.code?.language || ''}`
    const pairKey = `${normalizeCodeLanguage(language)}\u0000${source}`
    if (!uniquePairs.has(pairKey)) {
      uniquePairs.set(pairKey, { source, language })
    }
  }

  const highlightedPairs = await mapWithConcurrency(
    Array.from(uniquePairs.entries()),
    HIGHLIGHT_CODE_CONCURRENCY,
    async ([pairKey, pair]) => {
      const highlighted = await highlightCodeToHtml(pair.source, pair.language)
      return [pairKey, highlighted] as const
    }
  )
  const highlightedByPair = new Map<string, HighlightedCode>(highlightedPairs)

  const entries = codeBlocks.map((block: any) => {
    const source = getPlainTextFromRichText(block?.code?.rich_text || [])
    const language = `${block?.code?.language || ''}`
    const pairKey = `${normalizeCodeLanguage(language)}\u0000${source}`
    const highlighted = highlightedByPair.get(pairKey)
    return [block.id, highlighted!] as const
  })

  const result = Object.fromEntries(entries)
  writeHighlightedPageCache(cacheKey, result)
  return result
}

interface NotionRendererProps {
  document: NotionDocument | null
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageLinkMap
}

export default async function NotionRenderer({ document, linkPreviewMap = {}, pageLinkMap = {} }: NotionRendererProps) {
  // Keep article typography isolated from site-level font changes.
  const fontFamily = FONTS_MISANS.join(', ')

  if (!document) return null

  const blocksById = document.blocksById || {}
  const childrenById = document.childrenById || {}
  const rootIds = document.rootIds || []
  const highlightedCodeByBlockId = await buildHighlightedCodeMap(document.pageId || '', blocksById)

  const renderChildren = (blockId: string) => {
    const childIds = childrenById[blockId] || []
    if (!childIds.length) return null
    return renderBlockList(childIds)
  }

  const renderBulletedListItem = (block: any) => {
    const richText = block?.bulleted_list_item?.rich_text || []
    const className = getBlockClassName(block.id)
    return (
      <li key={block.id} className={className}>
        <div className="notion-text whitespace-pre-wrap">
          <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
        </div>
        {renderChildren(block.id)}
      </li>
    )
  }

  const renderNumberedListItem = (block: any) => {
    const richText = block?.numbered_list_item?.rich_text || []
    const className = getBlockClassName(block.id)
    return (
      <li key={block.id} className={className}>
        <div className="notion-text whitespace-pre-wrap">
          <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
        </div>
        {renderChildren(block.id)}
      </li>
    )
  }

  const renderToDoItem = (block: any) => {
    const toDo = block?.to_do || {}
    const richText = toDo.rich_text || []
    const checked = !!toDo.checked
    const className = getBlockClassName(block.id)

    return (
      <div key={block.id} className={cn(className, 'notion-to-do-block')}>
        <div className="notion-to-do-item flex items-baseline gap-1">
          <span className="notion-property-checkbox">
            <span
              className={cn('notion-to-do-checkbox', checked && 'is-checked')}
              role="img"
              aria-label={checked ? 'Checked' : 'Unchecked'}
            >
              {checked && (
                <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <path d="M4.5 10.5 8.3 14.3 15.5 6.8" />
                </svg>
              )}
            </span>
          </span>
          <div className="notion-to-do-body flex-1 min-w-0 whitespace-pre-wrap">
            <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
          </div>
        </div>
        <div className="pl-7">
          {renderChildren(block.id)}
        </div>
      </div>
    )
  }

  const renderColumnBlock = (block: any) => {
    const className = getBlockClassName(block.id)
    const flex = block?.column?.width_ratio || 1
    return (
      <div key={block.id} className={className} style={{ flex, minWidth: 0 }}>
        {renderChildren(block.id)}
      </div>
    )
  }

  const blockRendererRegistry: Record<string, (block: any) => React.ReactNode> = {
    bulleted_list_item: renderBulletedListItem,
    numbered_list_item: renderNumberedListItem,
    to_do: renderToDoItem,
    column: renderColumnBlock
  }

  const renderBlock = (block: any): React.ReactNode => {
    if (!block?.id) return null
    const className = getBlockClassName(block.id)
    const registeredRenderer = blockRendererRegistry[block.type]
    if (registeredRenderer) {
      return registeredRenderer(block)
    }

    switch (block.type) {
      case 'paragraph': {
        const richText = block?.paragraph?.rich_text || []
        return (
          <div key={block.id} className={className}>
            {richText.length > 0 && (
              <p className="notion-text whitespace-pre-wrap">
                <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
              </p>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'heading_1':
      case 'heading_2':
      case 'heading_3': {
        const richText = block?.[block.type]?.rich_text || []
        const headingClass = cn(
          'font-semibold text-inherit scroll-mt-20',
          block.type === 'heading_1' && 'text-[2rem] leading-[1.24] mt-12 mb-3',
          block.type === 'heading_2' && 'text-[1.62rem] leading-[1.28] mt-10 mb-2',
          block.type === 'heading_3' && 'text-[1.34rem] leading-[1.34] mt-8 mb-1.5'
        )
        const headingNode = block.type === 'heading_1'
          ? <h1 className={headingClass}><RichText richText={richText} linkPreviewMap={linkPreviewMap} /></h1>
          : block.type === 'heading_2'
            ? <h2 className={headingClass}><RichText richText={richText} linkPreviewMap={linkPreviewMap} /></h2>
            : <h3 className={headingClass}><RichText richText={richText} linkPreviewMap={linkPreviewMap} /></h3>
        return (
          <div key={block.id} id={getHeadingAnchorId(block.id)} className={className}>
            {headingNode}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'quote': {
        const richText = block?.quote?.rich_text || []
        return (
          <div key={block.id} className={className}>
            <blockquote className="notion-quote border-l-4 border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 rounded-r-md whitespace-pre-wrap">
              <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
            </blockquote>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'callout': {
        const callout = block?.callout || {}
        const richText = callout.rich_text || []
        const icon = callout.icon || null
        const iconUrl = getCalloutIconUrl(icon)
        const emoji = icon?.type === 'emoji' ? icon?.emoji : ''

        return (
          <div key={block.id} className={className}>
            <div className="notion-callout my-4 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/40 px-3 py-2 flex items-start">
              <span className="notion-page-icon-inline flex-none">
                {emoji ? (
                  <span aria-hidden="true">{emoji}</span>
                ) : iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={iconUrl} alt="" className="h-[1.05em] w-[1.05em] object-contain" />
                ) : (
                  <span aria-hidden="true">i</span>
                )}
              </span>
              <div className="notion-callout-text whitespace-pre-wrap">
                <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
              </div>
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'equation': {
        const expression = block?.equation?.expression || ''
        const html = renderEquationHtml(expression, true)
        return (
          <div key={block.id} className={className}>
            {expression ? (
              <div
                className="notion-equation-block my-4 overflow-x-auto text-center"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            ) : null}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'code': {
        const code = block?.code || {}
        const source = getPlainTextFromRichText(code.rich_text || [])
        const language = normalizeCodeLanguage(code.language || '')

        if (language === 'mermaid') {
          return (
            <div key={block.id} className={className}>
              <MermaidBlock code={source} className="my-4" />
              {renderChildren(block.id)}
            </div>
          )
        }

        const highlighted = highlightedCodeByBlockId[block.id]
        const displayLanguage = highlighted?.displayLanguage || `${code.language || ''}`.trim() || 'plain text'
        const highlightedHtml = highlighted?.html ||
          `<pre class="shiki shiki-themes github-light github-dark" style="color:#24292e;background-color:#fff;--shiki-light:#24292e;--shiki-light-bg:#fff;--shiki-dark:#e1e4e8;--shiki-dark-bg:#24292e"><code>${escapeHtml(source)}</code></pre>`

        return (
          <div key={block.id} className={className}>
            <div className="notion-code-block my-5 overflow-hidden">
              <span className="notion-code-language notion-code-language-floating">
                {displayLanguage}
              </span>
              <div
                className="notion-code-content"
                dangerouslySetInnerHTML={{ __html: highlightedHtml }}
              />
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'image': {
        const image = block?.image || {}
        const source = image.type === 'external'
          ? image?.external?.url
          : image?.file?.url
        const caption = image.caption || []
        const captionText = getPlainTextFromRichText(caption)

        if (!source) {
          return (
            <div key={block.id} className={className}>
              <div className="my-4 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500">
                Unsupported image source
              </div>
            </div>
          )
        }

        return (
          <figure key={block.id} className={cn(className, 'my-6')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={source}
              alt={captionText || 'Notion image'}
              loading="lazy"
              className="w-full rounded-md"
            />
            {caption.length > 0 && (
              <figcaption className="mt-2 notion-asset-caption whitespace-pre-wrap">
                <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
              </figcaption>
            )}
            {renderChildren(block.id)}
          </figure>
        )
      }
      case 'column_list': {
        const childIds = childrenById[block.id] || []
        const columns = childIds
          .map(id => blocksById[id])
          .filter((column: any) => column?.type === 'column')
        return (
          <div key={block.id} className={className}>
            {columns.length > 0 ? (
              <div className="my-4 flex flex-col gap-4 md:flex-row">
                {columns.map(renderColumnBlock)}
              </div>
            ) : (
              renderChildren(block.id)
            )}
          </div>
        )
      }
      case 'toggle': {
        const toggle = block?.toggle || {}
        const richText = toggle.rich_text || []
        const hasChildren = (childrenById[block.id] || []).length > 0
        return (
          <details
            key={block.id}
            className={cn(className, 'nobelium-toggle my-3', !hasChildren && 'nobelium-toggle-empty')}
          >
            <summary>
              <span className="nobelium-toggle-triangle" aria-hidden="true">
                <svg viewBox="0 0 16 16" role="presentation">
                  <path d="M6.5 3.5L11 8l-4.5 4.5z" />
                </svg>
              </span>
              <span className="nobelium-toggle-title whitespace-pre-wrap">
                <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
              </span>
            </summary>
            {hasChildren && (
              <div className="nobelium-toggle-content">
                {renderChildren(block.id)}
              </div>
            )}
          </details>
        )
      }
      case 'template': {
        const template = block?.template || {}
        const richText = template.rich_text || []
        return (
          <div key={block.id} className={className}>
            {richText.length > 0 && (
              <p className="notion-text whitespace-pre-wrap">
                <RichText richText={richText} linkPreviewMap={linkPreviewMap} />
              </p>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'table_of_contents': {
        const tocItems = document?.toc || []
        if (!tocItems.length) return null

        return (
          <nav key={block.id} className={cn(className, 'my-4 rounded-md border border-zinc-200 dark:border-zinc-700 px-3 py-2')}>
            <p className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Table of contents</p>
            <ul className="space-y-1">
              {tocItems.map(item => (
                <li key={`${block.id}-${item.id}`} style={{ marginLeft: `${item.indentLevel * 14}px` }}>
                  <a
                    href={`#${getHeadingAnchorId(item.id)}`}
                    className="text-sm text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100"
                  >
                    {item.text}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )
      }
      case 'link_to_page': {
        const linkToPage = block?.link_to_page || {}
        const targetId = `${linkToPage?.page_id || linkToPage?.database_id || linkToPage?.block_id || linkToPage?.comment_id || ''}`.trim()
        const href = resolvePageHref(targetId, pageLinkMap)
        const isInternal = href.startsWith('/')
        const cardClassName = 'inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300'
        return (
          <div key={block.id} className={cn(className, 'my-3')}>
            {href ? (
              <a
                href={href}
                target={isInternal ? undefined : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                className={cn(cardClassName, 'hover:border-zinc-400 dark:hover:border-zinc-500')}
              >
                <span aria-hidden="true">-&gt;</span>
                <span>{getLinkToPageLabel(linkToPage)}</span>
              </a>
            ) : (
              <div className={cardClassName}>
                <span aria-hidden="true">-&gt;</span>
                <span>{getLinkToPageLabel(linkToPage)}</span>
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'child_page': {
        const title = `${block?.child_page?.title || ''}`.trim() || 'Untitled page'
        const pageId = `${block?.id || ''}`
        const href = resolvePageHref(pageId, pageLinkMap) || buildNotionPublicUrl(pageId)
        const isInternal = href.startsWith('/')
        const cardClassName = 'inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300'
        return (
          <div key={block.id} className={cn(className, 'my-3')}>
            {href ? (
              <a
                href={href}
                target={isInternal ? undefined : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                className={cn(cardClassName, 'hover:border-zinc-400 dark:hover:border-zinc-500')}
              >
                <span aria-hidden="true">Pg</span><span className="whitespace-pre-wrap">{title}</span>
              </a>
            ) : (
              <div className={cardClassName}>
                <span aria-hidden="true">Pg</span><span className="whitespace-pre-wrap">{title}</span>
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'child_database': {
        const title = `${block?.child_database?.title || ''}`.trim() || 'Untitled database'
        const databaseId = `${block?.id || ''}`
        const href = resolvePageHref(databaseId, pageLinkMap) || buildNotionPublicUrl(databaseId)
        const isInternal = href.startsWith('/')
        const cardClassName = 'inline-flex items-center gap-2 rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/40 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-300'
        return (
          <div key={block.id} className={cn(className, 'my-3')}>
            {href ? (
              <a
                href={href}
                target={isInternal ? undefined : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                className={cn(cardClassName, 'hover:border-zinc-400 dark:hover:border-zinc-500')}
              >
                <span aria-hidden="true">DB</span><span className="whitespace-pre-wrap">{title}</span>
              </a>
            ) : (
              <div className={cardClassName}>
                <span aria-hidden="true">DB</span><span className="whitespace-pre-wrap">{title}</span>
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'synced_block': {
        const syncedFrom = block?.synced_block?.synced_from?.block_id || ''
        const hasChildren = (childrenById[block.id] || []).length > 0
        return (
          <div key={block.id} className={className}>
            {hasChildren ? (
              renderChildren(block.id)
            ) : (
              <div className="my-3 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
                {syncedFrom ? `Synced block (${syncedFrom.slice(0, 8)}...)` : 'Synced block'}
              </div>
            )}
          </div>
        )
      }
      case 'breadcrumb':
        return null
      case 'embed': {
        const embed = block?.embed || {}
        const embedUrl = embed.url
        const iframeUrl = resolveEmbedIframeUrl(embedUrl)
        const previewKey = normalizeRichTextUrl(embedUrl)
        const caption = embed.caption || []
        return (
          <div key={block.id} className={className}>
            <div className="my-4">
              {iframeUrl ? (
                <div className="relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={iframeUrl}
                    title={embedUrl || block.id}
                    className="absolute top-0 left-0 h-full w-full"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : !embedUrl ? (
                <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Unsupported embed block
                </div>
              ) : (
                <Suspense fallback={<LinkPreviewCardFallback />}>
                  <LinkPreviewCard url={embedUrl} initialData={linkPreviewMap[previewKey]} />
                </Suspense>
              )}
              {caption.length > 0 && (
                <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                  <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
                </div>
              )}
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'bookmark': {
        const bookmark = block?.bookmark || {}
        const bookmarkUrl = bookmark.url
        const previewKey = normalizeRichTextUrl(bookmarkUrl)
        const caption = bookmark.caption || []
        return (
          <div key={block.id} className={className}>
            {!bookmarkUrl ? (
              <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400 my-4">
                Unsupported bookmark block
              </div>
            ) : (
              <Suspense fallback={<LinkPreviewCardFallback />}>
                <LinkPreviewCard url={bookmarkUrl} initialData={linkPreviewMap[previewKey]} />
              </Suspense>
            )}
            {caption.length > 0 && (
              <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'video': {
        const video = block?.video || {}
        const source = getFileBlockUrl(video)
        const iframeUrl = resolveEmbedIframeUrl(source)
        const caption = video.caption || []
        return (
          <div key={block.id} className={className}>
            <div className="my-4">
              {!source ? (
                <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Unsupported video block
                </div>
              ) : iframeUrl ? (
                <div className="relative w-full overflow-hidden rounded-md border border-zinc-200 dark:border-zinc-700" style={{ paddingTop: '56.25%' }}>
                  <iframe
                    src={iframeUrl}
                    title={source || block.id}
                    className="absolute top-0 left-0 h-full w-full"
                    allowFullScreen
                    loading="lazy"
                  />
                </div>
              ) : (
                <video
                  src={source}
                  controls
                  preload="metadata"
                  className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-black"
                />
              )}
              {caption.length > 0 && (
                <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                  <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
                </div>
              )}
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'audio': {
        const audio = block?.audio || {}
        const source = getFileBlockUrl(audio)
        const caption = audio.caption || []
        return (
          <div key={block.id} className={className}>
            <div className="my-4">
              {!source ? (
                <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Unsupported audio block
                </div>
              ) : (
                <audio
                  src={source}
                  controls
                  preload="metadata"
                  className="w-full"
                />
              )}
              {caption.length > 0 && (
                <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                  <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
                </div>
              )}
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'pdf': {
        const pdf = block?.pdf || {}
        const source = getFileBlockUrl(pdf)
        const caption = pdf.caption || []
        return (
          <div key={block.id} className={className}>
            <div className="my-4 rounded-md border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {!source ? (
                <div className="p-3 text-sm text-zinc-500 dark:text-zinc-400">
                  Unsupported pdf block
                </div>
              ) : (
                <>
                  <iframe
                    src={source}
                    title={source || block.id}
                    className="w-full"
                    style={{ height: '620px' }}
                    loading="lazy"
                  />
                  <a
                    href={source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block border-t border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Open PDF
                  </a>
                </>
              )}
            </div>
            {caption.length > 0 && (
              <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'file': {
        const file = block?.file || {}
        const fileUrl = getFileBlockUrl(file)
        const caption = file.caption || []
        const fileName = getFileBlockName(file, fileUrl)

        return (
          <div key={block.id} className={className}>
            {!fileUrl ? (
              <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400 my-4">
                Unsupported file block
              </div>
            ) : (
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="notion-file-block"
              >
                <span className="notion-file-icon" aria-hidden="true">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" role="presentation">
                    <path d="M6 2.75h5.5L16 7.25V16a1.75 1.75 0 0 1-1.75 1.75H6A1.75 1.75 0 0 1 4.25 16V4.5A1.75 1.75 0 0 1 6 2.75Z" />
                    <path d="M11.5 2.75V7.25H16" />
                    <path d="M7.25 11.25h5.5M7.25 14h3.5" />
                  </svg>
                </span>
                <span className="notion-file-name">{fileName}</span>
              </a>
            )}
            {caption.length > 0 && (
              <div className="notion-asset-caption mt-2 whitespace-pre-wrap">
                <RichText richText={caption} linkPreviewMap={linkPreviewMap} />
              </div>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'table': {
        const table = block?.table || {}
        const rowIds = childrenById[block.id] || []
        const rows = rowIds
          .map(id => blocksById[id])
          .filter((row: any) => row?.type === 'table_row')

        const widthFromSchema = Number(table.table_width) || 0
        const widthFromRows = rows.reduce((max: number, row: any) => {
          const cells = row?.table_row?.cells
          return Math.max(max, Array.isArray(cells) ? cells.length : 0)
        }, 0)
        const columnCount = Math.max(widthFromSchema, widthFromRows)

        if (!rows.length || !columnCount) {
          return (
            <div key={block.id} className={className}>
              <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400 my-4">
                Unsupported table block
              </div>
              {renderChildren(block.id)}
            </div>
          )
        }

        return (
          <div key={block.id} className={className}>
            <div className="notion-table-wrapper my-4">
              <table className="notion-table-block">
                <tbody>
                  {rows.map((row: any, rowIndex: number) => {
                    const cells = Array.isArray(row?.table_row?.cells) ? row.table_row.cells : []
                    return (
                      <tr key={row.id || `${block.id}-${rowIndex}`}>
                        {Array.from({ length: columnCount }).map((_, colIndex: number) => {
                          const cellRichText = cells[colIndex] || []
                          const isColumnHeader = !!table.has_column_header && rowIndex === 0
                          const isRowHeader = !!table.has_row_header && colIndex === 0
                          const isHeader = isColumnHeader || isRowHeader

                          if (isHeader) {
                            return (
                              <th
                                key={`${row.id || rowIndex}-${colIndex}`}
                                className="notion-table-cell notion-table-cell-header"
                                scope={isColumnHeader ? 'col' : 'row'}
                              >
                                <div className="whitespace-pre-wrap">
                                  <RichText richText={cellRichText} linkPreviewMap={linkPreviewMap} />
                                </div>
                              </th>
                            )
                          }

                          return (
                            <td key={`${row.id || rowIndex}-${colIndex}`} className="notion-table-cell">
                              <div className="whitespace-pre-wrap">
                                <RichText richText={cellRichText} linkPreviewMap={linkPreviewMap} />
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'table_row':
        return null
      case 'link_preview': {
        const url = block?.link_preview?.url
        const previewKey = normalizeRichTextUrl(url)
        return (
          <div key={block.id} className={className}>
            {!url ? (
              <div className="rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400 my-4">
                Unsupported link preview block
              </div>
            ) : (
              <Suspense fallback={<LinkPreviewCardFallback />}>
                <LinkPreviewCard url={url} initialData={linkPreviewMap[previewKey]} />
              </Suspense>
            )}
            {renderChildren(block.id)}
          </div>
        )
      }
      case 'divider':
        return (
          <div key={block.id} className={className}>
            <hr className="notion-hr my-4 border-zinc-200 dark:border-zinc-700" />
            {renderChildren(block.id)}
          </div>
        )
      case 'unsupported':
      default:
        return (
          <div key={block.id} className={className}>
            <div className="my-4 rounded border border-dashed border-zinc-300 dark:border-zinc-700 p-3 text-sm text-zinc-500 dark:text-zinc-400">
              Unsupported block type: {block.type}
            </div>
            {renderChildren(block.id)}
          </div>
        )
    }
  }

  const renderBlockList = (blockIds: string[]) => {
    const nodes: React.ReactNode[] = []
    for (let i = 0; i < blockIds.length; i++) {
      const block = blocksById[blockIds[i]]
      if (!block) continue

      if (block.type === 'bulleted_list_item') {
        const listItems = [renderBulletedListItem(block)]
        while (i + 1 < blockIds.length) {
          const nextBlock = blocksById[blockIds[i + 1]]
          if (!nextBlock || nextBlock.type !== 'bulleted_list_item') break
          listItems.push(renderBulletedListItem(nextBlock))
          i += 1
        }
        nodes.push(
          <ul key={`bulleted-${block.id}`} className="notion-list list-disc my-3">
            {listItems}
          </ul>
        )
        continue
      }

      if (block.type === 'numbered_list_item') {
        const listItems = [renderNumberedListItem(block)]
        while (i + 1 < blockIds.length) {
          const nextBlock = blocksById[blockIds[i + 1]]
          if (!nextBlock || nextBlock.type !== 'numbered_list_item') break
          listItems.push(renderNumberedListItem(nextBlock))
          i += 1
        }
        nodes.push(
          <ol key={`numbered-${block.id}`} className="notion-list list-decimal my-3">
            {listItems}
          </ol>
        )
        continue
      }
      nodes.push(renderBlock(block))
    }
    return nodes
  }

  return (
    <div className="notion" style={{ fontFamily }}>
      {renderBlockList(rootIds)}
    </div>
  )
}



