import { Feed } from 'feed'
import type { NotionBlock, NotionDocument, NotionRichText } from './types'
import {
  buildNotionPublicUrl,
  escapeHtml,
  getFileBlockName,
  getFileBlockUrl,
  getLinkToPageLabel,
  getPlainTextFromRichText,
  normalizeNotionEntityId
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

function isLinkPreviewMention(item: NotionRichText): boolean {
  const value = item as { type?: string, mention?: { type?: string } }
  return value?.type === 'mention' && value?.mention?.type === 'link_preview'
}

function isLinkMention(item: NotionRichText): boolean {
  const value = item as { type?: string, mention?: { type?: string } }
  return value?.type === 'mention' && value?.mention?.type === 'link_mention'
}

function getRichTextHref(item: NotionRichText): string | null {
  if (!item || typeof item !== 'object') return null
  const value = item as {
    type?: string
    href?: string | null
    text?: { link?: { url?: string } | null }
    mention?: {
      link_preview?: { url?: string }
      link_mention?: { href?: string }
    }
  }

  if (value.type === 'text') {
    return value.text?.link?.url || value.href || null
  }

  if (isLinkPreviewMention(item)) {
    return value.mention?.link_preview?.url || value.href || null
  }

  if (isLinkMention(item)) {
    return value.mention?.link_mention?.href || value.href || null
  }

  return value.href || null
}

function renderRichTextHtml(richText: NotionRichText[] = []): string {
  return richText
    .map((item) => {
      const value = item as {
        type?: string
        plain_text?: string
        equation?: { expression?: string }
        annotations?: Record<string, boolean>
      }
      const raw = value?.type === 'equation'
        ? value?.equation?.expression || ''
        : value?.plain_text || ''
      if (!raw) return ''

      const annotations = value?.annotations || {}
      let output = escapeHtml(raw).replace(/\r?\n/g, '<br/>')

      if (annotations.code) output = `<code>${output}</code>`
      if (annotations.bold) output = `<strong>${output}</strong>`
      if (annotations.italic) output = `<em>${output}</em>`
      if (annotations.strikethrough) output = `<s>${output}</s>`
      if (annotations.underline) output = `<u>${output}</u>`

      const href = getRichTextHref(item)
      if (href) {
        output = `<a href="${escapeHtml(href)}">${output}</a>`
      }

      return output
    })
    .join('')
}

function renderListItemHtml(
  block: NotionBlock,
  blocksById: Record<string, NotionBlock>,
  childrenById: Record<string, string[]>
): string {
  const payload = (block as any)[block.type] || {}
  const text = renderRichTextHtml(payload.rich_text || [])
  const childHtml = renderBlockListHtml(childrenById[block.id] || [], blocksById, childrenById)

  if (block.type === 'to_do') {
    const marker = payload.checked ? '&#x2611;' : '&#x2610;'
    return `<li>${marker} ${text}${childHtml}</li>`
  }

  return `<li>${text}${childHtml}</li>`
}

function renderTableHtml(
  block: NotionBlock,
  blocksById: Record<string, NotionBlock>,
  childrenById: Record<string, string[]>
): string {
  const table = (block as any).table || {}
  const rows = (childrenById[block.id] || [])
    .map(id => blocksById[id])
    .filter(row => row?.type === 'table_row')

  const widthFromSchema = Number(table.table_width) || 0
  const widthFromRows = rows.reduce((max, row) => {
    const cells = (row as any)?.table_row?.cells
    return Math.max(max, Array.isArray(cells) ? cells.length : 0)
  }, 0)
  const columnCount = Math.max(widthFromSchema, widthFromRows)

  if (!rows.length || !columnCount) return ''

  const body = rows.map((row, rowIndex) => {
    const cells = Array.isArray((row as any)?.table_row?.cells) ? (row as any).table_row.cells : []
    const rowHtml = Array.from({ length: columnCount }).map((_, colIndex) => {
      const cellRichText = cells[colIndex] || []
      const content = renderRichTextHtml(cellRichText) || '&nbsp;'
      const isHeader = (!!table.has_column_header && rowIndex === 0) || (!!table.has_row_header && colIndex === 0)
      const tag = isHeader ? 'th' : 'td'
      return `<${tag}>${content}</${tag}>`
    }).join('')
    return `<tr>${rowHtml}</tr>`
  }).join('')

  return `<table><tbody>${body}</tbody></table>`
}

function renderPageReferenceHtml(block: NotionBlock, pageHrefMap: Record<string, string>): string {
  const data = block as any
  const rawTargetId = `${data.link_to_page?.page_id || data.link_to_page?.database_id || data.link_to_page?.block_id || data.link_to_page?.comment_id || block.id || ''}`.trim()
  const normalizedTargetId = normalizeNotionEntityId(rawTargetId)
  const href = pageHrefMap[normalizedTargetId] || buildNotionPublicUrl(rawTargetId)
  const label = block.type === 'link_to_page'
    ? getLinkToPageLabel(data.link_to_page)
    : `${data[block.type]?.title || ''}`.trim() || 'Untitled'

  return href
    ? `<p><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`
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

  const data = block as any
  const childHtml = renderBlockListHtml(childrenById[blockId] || [], blocksById, childrenById, options)
  const pageHrefMap = options.pageHrefMap || {}

  switch (block.type) {
    case 'paragraph': {
      const text = renderRichTextHtml(data.paragraph?.rich_text || [])
      return `${text ? `<p>${text}</p>` : ''}${childHtml}`
    }
    case 'heading_1': {
      const text = renderRichTextHtml(data.heading_1?.rich_text || [])
      return `${text ? `<h1>${text}</h1>` : ''}${childHtml}`
    }
    case 'heading_2': {
      const text = renderRichTextHtml(data.heading_2?.rich_text || [])
      return `${text ? `<h2>${text}</h2>` : ''}${childHtml}`
    }
    case 'heading_3': {
      const text = renderRichTextHtml(data.heading_3?.rich_text || [])
      return `${text ? `<h3>${text}</h3>` : ''}${childHtml}`
    }
    case 'quote': {
      const text = renderRichTextHtml(data.quote?.rich_text || [])
      return `${text ? `<blockquote>${text}</blockquote>` : ''}${childHtml}`
    }
    case 'callout': {
      const text = renderRichTextHtml(data.callout?.rich_text || [])
      const emoji = data.callout?.icon?.type === 'emoji' ? data.callout.icon.emoji || '' : ''
      const prefix = emoji ? `${escapeHtml(emoji)} ` : ''
      return `${text ? `<blockquote>${prefix}${text}</blockquote>` : ''}${childHtml}`
    }
    case 'equation': {
      const expression = `${data.equation?.expression || ''}`.trim()
      return `${expression ? `<p><code>${escapeHtml(expression)}</code></p>` : ''}${childHtml}`
    }
    case 'code': {
      const code = data.code || {}
      const source = escapeHtml(getPlainTextFromRichText(code.rich_text || [], false))
      const language = code.language ? ` class="language-${escapeHtml(code.language)}"` : ''
      return `<pre><code${language}>${source}</code></pre>${childHtml}`
    }
    case 'toggle': {
      const text = renderRichTextHtml(data.toggle?.rich_text || [])
      return `<details><summary>${text || 'Toggle'}</summary>${childHtml}</details>`
    }
    case 'template': {
      const text = renderRichTextHtml(data.template?.rich_text || [])
      return `${text ? `<p>${text}</p>` : ''}${childHtml}`
    }
    case 'image': {
      const source = data.image?.type === 'external' ? data.image.external?.url : data.image?.file?.url
      const caption = renderRichTextHtml(data.image?.caption || [])
      const alt = escapeHtml(getPlainTextFromRichText(data.image?.caption || [], true) || 'Notion image')
      return source
        ? `<figure><img src="${escapeHtml(source)}" alt="${alt}" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>${childHtml}`
        : childHtml
    }
    case 'video': {
      const source = getFileBlockUrl(data.video)
      const caption = renderRichTextHtml(data.video?.caption || [])
      const name = escapeHtml(getFileBlockName(data.video, source))
      return `${source ? `<p><a href="${escapeHtml(source)}">${name}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'audio': {
      const source = getFileBlockUrl(data.audio)
      const caption = renderRichTextHtml(data.audio?.caption || [])
      const name = escapeHtml(getFileBlockName(data.audio, source))
      return `${source ? `<p><a href="${escapeHtml(source)}">${name}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'pdf': {
      const source = getFileBlockUrl(data.pdf)
      const caption = renderRichTextHtml(data.pdf?.caption || [])
      return `${source ? `<p><a href="${escapeHtml(source)}">Open PDF</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'file': {
      const source = getFileBlockUrl(data.file)
      const caption = renderRichTextHtml(data.file?.caption || [])
      const name = escapeHtml(getFileBlockName(data.file, source))
      return `${source ? `<p><a href="${escapeHtml(source)}">${name}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'embed': {
      const url = `${data.embed?.url || ''}`.trim()
      const caption = renderRichTextHtml(data.embed?.caption || [])
      return `${url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'bookmark': {
      const url = `${data.bookmark?.url || ''}`.trim()
      const caption = renderRichTextHtml(data.bookmark?.caption || [])
      return `${url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''}${caption ? `<p>${caption}</p>` : ''}${childHtml}`
    }
    case 'link_preview': {
      const url = `${data.link_preview?.url || ''}`.trim()
      return `${url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''}${childHtml}`
    }
    case 'divider':
      return `<hr/>${childHtml}`
    case 'column':
    case 'column_list':
    case 'synced_block':
    case 'breadcrumb':
      return childHtml
    case 'table':
      return `${renderTableHtml(block, blocksById, childrenById)}${childHtml}`
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
      return renderListItemHtml(block, blocksById, childrenById)
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

    if (block.type === 'bulleted_list_item' || block.type === 'numbered_list_item' || block.type === 'to_do') {
      const listTag = block.type === 'numbered_list_item' ? 'ol' : 'ul'
      const items = [renderListItemHtml(block, blocksById, childrenById)]

      while (index + 1 < blockIds.length && blocksById[blockIds[index + 1]]?.type === block.type) {
        items.push(renderListItemHtml(blocksById[blockIds[index + 1]], blocksById, childrenById))
        index += 1
      }

      output.push(`<${listTag}>${items.join('')}</${listTag}>`)
      continue
    }

    output.push(renderBlockHtml(block.id, blocksById, childrenById, options))
  }

  return output.filter(Boolean).join('')
}

export function renderNotionDocumentToHtml(
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

export function generateRssFeed({
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
