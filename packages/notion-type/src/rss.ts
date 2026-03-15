import { Feed } from 'feed'
import type { RenderAdapter, ValueAdapter } from './adapters'
import type {
  NotionBlock,
  NotionBulletedListItemBlock,
  NotionDocument,
  NotionLinkToPageBlock,
  NotionNumberedListItemBlock,
  NotionRichText,
  NotionTableBlock,
  NotionTableRowBlock,
  NotionToDoBlock
} from './types'
import {
  escapeHtml,
  getFileBlockName,
  getFileBlockUrl,
  getLinkToPageLabel,
  getPlainTextFromRichText,
  isInternalHref,
  resolvePageHref,
  rewriteNotionPageHref
} from './utils/notion'

export interface RssAuthor {
  name: string
  email?: string
  link?: string
}

export interface RssCategory {
  name: string
  scheme?: string
  domain?: string
}

export interface RenderNotionHtmlOptions {
  pageHrefMap?: Record<string, string>
}

export interface RssFeedItemInput {
  title: string
  link: string
  date: string | number | Date
  id?: string
  description?: string
  document?: NotionDocument | null
  contentHtml?: string
  author?: RssAuthor[]
  category?: RssCategory[]
}

export interface GenerateRssFeedOptions {
  title: string
  description: string
  siteUrl: string
  items: RssFeedItemInput[]
  id?: string
  language?: string
  favicon?: string
  copyright?: string
  author?: RssAuthor
  updated?: string | number | Date
  feedLinks?: {
    rss2?: string
    atom?: string
    json?: string
  }
}

/**
 * EN: Adapter contract for rendering normalized Notion documents to HTML.
 * ZH: 将标准化 Notion 文档渲染为 HTML 的适配器契约。
 */
export interface NotionDocumentHtmlAdapter extends RenderAdapter<NotionDocument | null, RenderNotionHtmlOptions, string> {}

/**
 * EN: Adapter contract for generating RSS XML.
 * ZH: 生成 RSS XML 的适配器契约。
 */
export interface NotionRssFeedAdapter extends ValueAdapter<GenerateRssFeedOptions, string> {}

/**
 * EN: RSS output adapter group.
 * ZH: RSS 输出适配器组合。
 */
export interface NotionRssAdapter {
  documentHtml: NotionDocumentHtmlAdapter
  feed: NotionRssFeedAdapter
}

function trimSlashes(value: string): string {
  return `${value || ''}`.replace(/^\/+|\/+$/g, '')
}

function toAbsoluteUrl(siteUrl: string, path?: string): string {
  const normalizedSiteUrl = `${siteUrl || ''}`.trim() || 'https://example.com'
  try {
    const base = new URL(normalizedSiteUrl)
    const normalizedPath = trimSlashes(path || '')
    if (!normalizedPath) return base.toString().replace(/\/+$/g, '')
    return new URL(`${normalizedPath}`, `${base.toString().replace(/\/?$/, '/')}`).toString()
  } catch {
    return normalizedSiteUrl || 'https://example.com'
  }
}

function toDate(value: string | number | Date | undefined): Date {
  const parsed = value instanceof Date ? value : new Date(value || Date.now())
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function getMentionPayload(item: NotionRichText): Record<string, unknown> | null {
  const mention = (item as { mention?: unknown }).mention
  return mention && typeof mention === 'object' ? mention as Record<string, unknown> : null
}

function getTextLinkUrl(item: NotionRichText): string | null {
  if (item.type !== 'text') return null
  return (item as { text?: { link?: { url?: string } | null } }).text?.link?.url || null
}

function getEquationExpression(item: NotionRichText): string {
  if (item.type !== 'equation') return ''
  return (item as { equation?: { expression?: string } }).equation?.expression || ''
}

function isLinkPreviewMention(item: NotionRichText): item is Extract<NotionRichText, { type: 'mention' }> {
  const mention = getMentionPayload(item)
  return item.type === 'mention' && mention?.type === 'link_preview'
}

function isLinkMention(item: NotionRichText): item is Extract<NotionRichText, { type: 'mention' }> {
  const mention = getMentionPayload(item)
  return item.type === 'mention' && mention?.type === 'link_mention'
}

function getRichTextHref(item: NotionRichText): string | null {
  if (item.type === 'text') {
    return getTextLinkUrl(item) || item.href || null
  }

  if (isLinkPreviewMention(item)) {
    return (item.mention as { link_preview?: { url?: string } | undefined } | undefined)?.link_preview?.url || item.href || null
  }

  if (isLinkMention(item)) {
    return (item.mention as { link_mention?: { href?: string } | undefined } | undefined)?.link_mention?.href || item.href || null
  }

  return item.href || null
}

function renderHrefHtml(href: string): string {
  const target = isInternalHref(href) ? '' : ' target="_blank" rel="noopener noreferrer"'
  return ` href="${escapeHtml(href)}"${target}`
}

function renderRichTextHtml(richText: NotionRichText[] = [], options: RenderNotionHtmlOptions = {}): string {
  return richText
    .map((item) => {
      const raw = item.type === 'equation'
        ? getEquationExpression(item)
        : item.plain_text || ''
      if (!raw) return ''

      const annotations = item.annotations || {}
      let output = escapeHtml(raw).replace(/\r?\n/g, '<br/>')

      if (annotations.code) output = `<code>${output}</code>`
      if (annotations.bold) output = `<strong>${output}</strong>`
      if (annotations.italic) output = `<em>${output}</em>`
      if (annotations.strikethrough) output = `<s>${output}</s>`
      if (annotations.underline) output = `<u>${output}</u>`

      const href = rewriteNotionPageHref(getRichTextHref(item), options.pageHrefMap || {})
      if (href) {
        output = `<a${renderHrefHtml(href)}>${output}</a>`
      }

      return output
    })
    .join('')
}

function isTableRowBlock(block: NotionBlock | undefined): block is NotionTableRowBlock {
  return block?.type === 'table_row'
}

function isListItemBlock(block: NotionBlock | undefined): block is NotionBulletedListItemBlock | NotionNumberedListItemBlock | NotionToDoBlock {
  return block?.type === 'bulleted_list_item' || block?.type === 'numbered_list_item' || block?.type === 'to_do'
}

function getListItemRichText(block: NotionBulletedListItemBlock | NotionNumberedListItemBlock | NotionToDoBlock): NotionRichText[] {
  switch (block.type) {
    case 'bulleted_list_item':
      return block.bulleted_list_item.rich_text
    case 'numbered_list_item':
      return block.numbered_list_item.rich_text
    case 'to_do':
      return block.to_do.rich_text
  }
}

function renderListItemHtml(
  block: NotionBulletedListItemBlock | NotionNumberedListItemBlock | NotionToDoBlock,
  blocksById: Record<string, NotionBlock>,
  childrenById: Record<string, string[]>,
  options: RenderNotionHtmlOptions
): string {
  const text = renderRichTextHtml(getListItemRichText(block), options)
  const childHtml = renderBlockListHtml(childrenById[block.id] || [], blocksById, childrenById, options)

  if (block.type === 'to_do') {
    const marker = block.to_do.checked ? '&#x2611;' : '&#x2610;'
    return `<li>${marker} ${text}${childHtml}</li>`
  }

  return `<li>${text}${childHtml}</li>`
}

function renderTableHtml(
  block: NotionTableBlock,
  blocksById: Record<string, NotionBlock>,
  childrenById: Record<string, string[]>,
  options: RenderNotionHtmlOptions
): string {
  const table = block.table
  const rows = (childrenById[block.id] || [])
    .map(id => blocksById[id])
    .filter(isTableRowBlock)

  const widthFromSchema = Number(table.table_width) || 0
  const widthFromRows = rows.reduce((max, row) => {
    return Math.max(max, row.table_row.cells.length)
  }, 0)
  const columnCount = Math.max(widthFromSchema, widthFromRows)

  if (!rows.length || !columnCount) return ''

  const body = rows.map((row, rowIndex) => {
    const cells = row.table_row.cells
    const rowHtml = Array.from({ length: columnCount }).map((_, colIndex) => {
      const cellRichText = cells[colIndex] || []
      const content = renderRichTextHtml(cellRichText, options) || '&nbsp;'
      const isHeader = (!!table.has_column_header && rowIndex === 0) || (!!table.has_row_header && colIndex === 0)
      const tag = isHeader ? 'th' : 'td'
      return `<${tag}>${content}</${tag}>`
    }).join('')
    return `<tr>${rowHtml}</tr>`
  }).join('')

  return `<table><tbody>${body}</tbody></table>`
}

function renderPageReferenceHtml(block: NotionLinkToPageBlock | Extract<NotionBlock, { type: 'child_page' | 'child_database' }>, pageHrefMap: Record<string, string>): string {
  const rawTargetId = block.type === 'link_to_page'
    ? `${block.link_to_page.page_id || block.link_to_page.database_id || block.link_to_page.block_id || block.link_to_page.comment_id || block.id || ''}`.trim()
    : `${block.id || ''}`.trim()
  const href = resolvePageHref(rawTargetId, pageHrefMap)
  const label = block.type === 'link_to_page'
    ? getLinkToPageLabel(block.link_to_page)
    : block.type === 'child_page'
      ? `${block.child_page.title || ''}`.trim() || 'Untitled'
      : `${block.child_database.title || ''}`.trim() || 'Untitled'

  return href
    ? `<p><a${renderHrefHtml(href)}>${escapeHtml(label)}</a></p>`
    : `<p>${escapeHtml(label)}</p>`
}

function renderBlockHtml(
  blockId: string,
  blocksById: Record<string, NotionBlock>,
  childrenById: Record<string, string[]>,
  options: RenderNotionHtmlOptions
): string {
  const block = blocksById[blockId]
  if (!block) return ''

  const childHtml = renderBlockListHtml(childrenById[blockId] || [], blocksById, childrenById, options)
  const pageHrefMap = options.pageHrefMap || {}

  switch (block.type) {
    case 'paragraph': {
      const text = renderRichTextHtml(block.paragraph.rich_text, options)
      return `${text ? `<p>${text}</p>` : ''}${childHtml}`
    }
    case 'heading_1': {
      const text = renderRichTextHtml(block.heading_1.rich_text, options)
      return `${text ? `<h1>${text}</h1>` : ''}${childHtml}`
    }
    case 'heading_2': {
      const text = renderRichTextHtml(block.heading_2.rich_text, options)
      return `${text ? `<h2>${text}</h2>` : ''}${childHtml}`
    }
    case 'heading_3': {
      const text = renderRichTextHtml(block.heading_3.rich_text, options)
      return `${text ? `<h3>${text}</h3>` : ''}${childHtml}`
    }
    case 'quote': {
      const text = renderRichTextHtml(block.quote.rich_text, options)
      return `${text ? `<blockquote>${text}</blockquote>` : ''}${childHtml}`
    }
    case 'callout': {
      const text = renderRichTextHtml(block.callout.rich_text, options)
      const emoji = block.callout.icon?.type === 'emoji' ? block.callout.icon.emoji || '' : ''
      const prefix = emoji ? `${escapeHtml(emoji)} ` : ''
      return `${text ? `<blockquote>${prefix}${text}</blockquote>` : ''}${childHtml}`
    }
    case 'equation': {
      const expression = `${block.equation.expression || ''}`.trim()
      return `${expression ? `<p><code>${escapeHtml(expression)}</code></p>` : ''}${childHtml}`
    }
    case 'code': {
      const code = block.code
      const source = escapeHtml(getPlainTextFromRichText(code.rich_text, false))
      const language = code.language ? ` class="language-${escapeHtml(code.language)}"` : ''
      return `<pre><code${language}>${source}</code></pre>${childHtml}`
    }
    case 'toggle': {
      const text = renderRichTextHtml(block.toggle.rich_text, options)
      return `<details><summary>${text || 'Toggle'}</summary>${childHtml}</details>`
    }
    case 'template': {
      const text = renderRichTextHtml(block.template.rich_text, options)
      return `${text ? `<p>${text}</p>` : ''}${childHtml}`
    }
    case 'image': {
      const source = block.image.type === 'external' ? block.image.external?.url : block.image.file?.url
      const caption = renderRichTextHtml(block.image.caption || [], options)
      const alt = escapeHtml(getPlainTextFromRichText(block.image.caption || [], true) || 'Notion image')
      return source
        ? `<figure><img src="${escapeHtml(source)}" alt="${alt}" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>${childHtml}`
        : childHtml
    }
    case 'video': {
      const source = getFileBlockUrl(block.video)
      const caption = renderRichTextHtml(block.video.caption || [], options)
      const name = escapeHtml(getFileBlockName(block.video, source))
      return `${source ? `<p><a${renderHrefHtml(source)}>${name}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'audio': {
      const source = getFileBlockUrl(block.audio)
      const caption = renderRichTextHtml(block.audio.caption || [], options)
      const name = escapeHtml(getFileBlockName(block.audio, source))
      return `${source ? `<p><a${renderHrefHtml(source)}>${name}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'pdf': {
      const source = getFileBlockUrl(block.pdf)
      const caption = renderRichTextHtml(block.pdf.caption || [], options)
      return `${source ? `<p><a${renderHrefHtml(source)}>Open PDF</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'file': {
      const source = getFileBlockUrl(block.file)
      const caption = renderRichTextHtml(block.file.caption || [], options)
      const name = escapeHtml(getFileBlockName(block.file, source))
      return `${source ? `<p><a${renderHrefHtml(source)}>${name}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'embed': {
      const url = `${block.embed.url || ''}`.trim()
      const caption = renderRichTextHtml(block.embed.caption || [], options)
      return `${url ? `<p><a${renderHrefHtml(url)}>${escapeHtml(url)}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'bookmark': {
      const url = `${block.bookmark.url || ''}`.trim()
      const caption = renderRichTextHtml(block.bookmark.caption || [], options)
      return `${url ? `<p><a${renderHrefHtml(url)}>${escapeHtml(url)}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'link_preview': {
      const url = `${block.link_preview.url || ''}`.trim()
      return `${url ? `<p><a${renderHrefHtml(url)}>${escapeHtml(url)}</a></p>` : ''}${childHtml}`
    }
    case 'divider':
      return `<hr/>${childHtml}`
    case 'column':
    case 'column_list':
    case 'synced_block':
    case 'breadcrumb':
      return childHtml
    case 'table':
      return `${renderTableHtml(block, blocksById, childrenById, options)}${childHtml}`
    case 'table_row':
      return ''
    case 'table_of_contents':
      return ''
    case 'link_to_page':
    case 'child_page':
    case 'child_database':
      return `${renderPageReferenceHtml(block, pageHrefMap)}${childHtml}`
    case 'bulleted_list_item':
    case 'numbered_list_item':
    case 'to_do':
      return renderListItemHtml(block, blocksById, childrenById, options)
    default:
      return childHtml
  }
}

function renderBlockListHtml(
  blockIds: string[],
  blocksById: Record<string, NotionBlock>,
  childrenById: Record<string, string[]>,
  options: RenderNotionHtmlOptions = {}
): string {
  const output: string[] = []

  for (let index = 0; index < blockIds.length; index += 1) {
    const block = blocksById[blockIds[index]]
    if (!block) continue

    if (isListItemBlock(block)) {
      const listTag = block.type === 'numbered_list_item' ? 'ol' : 'ul'
      const items = [renderListItemHtml(block, blocksById, childrenById, options)]

      while (index + 1 < blockIds.length && isListItemBlock(blocksById[blockIds[index + 1]]) && blocksById[blockIds[index + 1]]?.type === block.type) {
        const nextBlock = blocksById[blockIds[index + 1]]
        if (!isListItemBlock(nextBlock)) break
        items.push(renderListItemHtml(nextBlock, blocksById, childrenById, options))
        index += 1
      }

      output.push(`<${listTag}>${items.join('')}</${listTag}>`)
      continue
    }

    output.push(renderBlockHtml(block.id, blocksById, childrenById, options))
  }

  return output.filter(Boolean).join('')
}

function renderNotionDocumentToHtmlWithDefaultAdapter(
  document: NotionDocument | null,
  options: RenderNotionHtmlOptions = {}
): string {
  if (!document) return ''
  return renderBlockListHtml(
    document.rootIds || [],
    document.blocksById || {},
    document.childrenById || {},
    options
  ).trim()
}

function generateRssFeedWithDefaultAdapter({
  title,
  description,
  siteUrl,
  items,
  id,
  language,
  favicon,
  copyright,
  author,
  updated,
  feedLinks
}: GenerateRssFeedOptions): string {
  const normalizedSiteUrl = toAbsoluteUrl(siteUrl)
  const feed = new Feed({
    title,
    description,
    id: id || normalizedSiteUrl,
    link: normalizedSiteUrl,
    language,
    favicon,
    copyright,
    updated: updated ? toDate(updated) : undefined,
    author,
    feedLinks
  })

  for (const item of items) {
    const content = `${item.contentHtml || ''}`.trim() || renderNotionDocumentToHtml(item.document || null)

    feed.addItem({
      title: item.title,
      id: item.id || item.link,
      link: toAbsoluteUrl(normalizedSiteUrl, item.link),
      description: item.description,
      content,
      date: toDate(item.date),
      author: item.author,
      category: item.category
    })
  }

  return feed.rss2()
}

/**
 * EN: Default RSS adapter implementation.
 * ZH: 默认 RSS 适配器实现。
 */
export const rssAdapter: NotionRssAdapter = {
  documentHtml: {
    render: renderNotionDocumentToHtmlWithDefaultAdapter
  },
  feed: {
    adapt: generateRssFeedWithDefaultAdapter
  }
}

/**
 * EN: Compatibility wrapper for `rssAdapter.documentHtml.render`.
 * ZH: `rssAdapter.documentHtml.render` 的兼容包装函数。
 */
export function renderNotionDocumentToHtml(
  document: NotionDocument | null,
  options: RenderNotionHtmlOptions = {}
): string {
  return rssAdapter.documentHtml.render(document, options)
}

/**
 * EN: Compatibility wrapper for `rssAdapter.feed.adapt`.
 * ZH: `rssAdapter.feed.adapt` 的兼容包装函数。
 */
export function generateRssFeed(options: GenerateRssFeedOptions): string {
  return rssAdapter.feed.adapt(options)
}