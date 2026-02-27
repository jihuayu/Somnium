import { Feed } from 'feed'
import { unstable_cache } from 'next/cache'
import { config } from '@/lib/server/config'
import { buildNotionDocument, type NotionDocument } from '@/lib/notion/getPostBlocks'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

const FEED_POST_BLOCKS_CACHE_SECONDS = 60 * 60 * 24

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function resolveSiteUrl(siteOrigin?: string): string {
  const input = (siteOrigin || config.link || '').trim()
  const fallback = 'https://example.com'
  const normalized = input || fallback

  try {
    const url = new URL(normalized)
    const root = url.origin.replace(/\/+$/g, '')
    const basePath = trimSlashes(config.path || '')
    return basePath ? `${root}/${basePath}` : root
  } catch {
    return fallback
  }
}

function buildUrl(baseUrl: string, path?: string): string {
  const root = baseUrl.replace(/\/+$/g, '')
  const suffix = trimSlashes(path || '')
  return suffix ? `${root}/${suffix}` : root
}

const getCachedFeedDocument = unstable_cache(
  async (postId: string) => buildNotionDocument(postId, { includeToc: false }),
  ['feed-post-blocks-v3'],
  { revalidate: FEED_POST_BLOCKS_CACHE_SECONDS, tags: ['feed-post-blocks'] }
)

interface FeedContentPayload {
  html: string
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function getPlainTextFromRichText(richText: any[] = [], trim = true): string {
  const text = richText.map(item => item?.plain_text || '').join('')
  return trim ? text.trim() : text
}

function getFileBlockUrl(filePayload: any): string {
  if (!filePayload || typeof filePayload !== 'object') return ''
  if (filePayload.type === 'external') return filePayload?.external?.url || ''
  if (filePayload.type === 'file') return filePayload?.file?.url || ''
  return filePayload?.external?.url || filePayload?.file?.url || ''
}

function getFileNameFromUrl(fileUrl: string): string {
  if (!fileUrl) return 'File'
  try {
    const parsed = new URL(fileUrl)
    const filename = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '')
    return filename || parsed.hostname || 'File'
  } catch {
    return 'File'
  }
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

function isLinkPreviewMention(item: any): boolean {
  return item?.type === 'mention' && item?.mention?.type === 'link_preview'
}

function isLinkMention(item: any): boolean {
  return item?.type === 'mention' && item?.mention?.type === 'link_mention'
}

function getRichTextHrefByType(item: any): string | null {
  if (!item || typeof item !== 'object') return null

  if (item.type === 'text') {
    return item?.text?.link?.url || null
  }

  if (isLinkPreviewMention(item)) {
    return item?.mention?.link_preview?.url || item?.href || null
  }

  if (isLinkMention(item)) {
    return item?.mention?.link_mention?.href || item?.href || null
  }

  return item?.href || null
}

function getHtmlFromRichText(richText: any[] = []): string {
  return richText
    .map(item => {
      const raw = item?.type === 'equation'
        ? item?.equation?.expression || ''
        : item?.plain_text || ''
      if (!raw) return ''

      const annotations = item?.annotations || {}
      let output = escapeHtml(raw).replace(/\r?\n/g, '<br/>')

      if (annotations.code) output = `<code>${output}</code>`
      if (annotations.bold) output = `<strong>${output}</strong>`
      if (annotations.italic) output = `<em>${output}</em>`
      if (annotations.strikethrough) output = `<s>${output}</s>`
      if (annotations.underline) output = `<u>${output}</u>`

      const href = getRichTextHrefByType(item)
      if (href) output = `<a href="${escapeHtml(href)}">${output}</a>`

      return output
    })
    .join('')
}

function renderBlockHtml(
  blockId: string,
  blocksById: Record<string, any>,
  childrenById: Record<string, string[]>
): string {
  const block = blocksById[blockId]
  if (!block) return ''

  const childIds = childrenById[blockId] || []
  const renderedChildren = childIds
    .map(childId => renderBlockHtml(childId, blocksById, childrenById))
    .filter(Boolean)
    .join('')

  switch (block.type) {
    case 'paragraph': {
      const text = getHtmlFromRichText(block?.paragraph?.rich_text || [])
      return `${text ? `<p>${text}</p>` : ''}${renderedChildren}`
    }
    case 'heading_1': {
      const text = getHtmlFromRichText(block?.heading_1?.rich_text || [])
      return `${text ? `<h1>${text}</h1>` : ''}${renderedChildren}`
    }
    case 'heading_2': {
      const text = getHtmlFromRichText(block?.heading_2?.rich_text || [])
      return `${text ? `<h2>${text}</h2>` : ''}${renderedChildren}`
    }
    case 'heading_3': {
      const text = getHtmlFromRichText(block?.heading_3?.rich_text || [])
      return `${text ? `<h3>${text}</h3>` : ''}${renderedChildren}`
    }
    case 'quote': {
      const text = getHtmlFromRichText(block?.quote?.rich_text || [])
      return `${text ? `<blockquote>${text}</blockquote>` : ''}${renderedChildren}`
    }
    case 'bulleted_list_item': {
      const text = getHtmlFromRichText(block?.bulleted_list_item?.rich_text || [])
      return `<ul><li>${text}${renderedChildren}</li></ul>`
    }
    case 'numbered_list_item': {
      const text = getHtmlFromRichText(block?.numbered_list_item?.rich_text || [])
      return `<ol><li>${text}${renderedChildren}</li></ol>`
    }
    case 'to_do': {
      const text = getHtmlFromRichText(block?.to_do?.rich_text || [])
      const checked = !!block?.to_do?.checked
      const marker = checked ? '&#x2611;' : '&#x2610;'
      return `<p>${marker} ${text}</p>${renderedChildren}`
    }
    case 'callout': {
      const text = getHtmlFromRichText(block?.callout?.rich_text || [])
      const emoji = block?.callout?.icon?.type === 'emoji' ? block?.callout?.icon?.emoji || '' : ''
      const prefix = emoji ? `${escapeHtml(emoji)} ` : ''
      return `${text ? `<blockquote>${prefix}${text}</blockquote>` : ''}${renderedChildren}`
    }
    case 'equation': {
      const expression = `${block?.equation?.expression || ''}`.trim()
      return `${expression ? `<p><code>${escapeHtml(expression)}</code></p>` : ''}${renderedChildren}`
    }
    case 'code': {
      const code = block?.code || {}
      const source = escapeHtml(getPlainTextFromRichText(code.rich_text || [], false))
      const language = code.language ? ` class="language-${escapeHtml(code.language)}"` : ''
      return `<pre><code${language}>${source}</code></pre>${renderedChildren}`
    }
    case 'toggle': {
      const text = getHtmlFromRichText(block?.toggle?.rich_text || [])
      return `<details><summary>${text || 'Toggle'}</summary>${renderedChildren}</details>`
    }
    case 'image': {
      const image = block?.image || {}
      const source = image.type === 'external'
        ? image?.external?.url
        : image?.file?.url
      const caption = getHtmlFromRichText(image.caption || [])
      const imageHtml = source
        ? `<figure><img src="${escapeHtml(source)}" alt="${escapeHtml(getPlainTextFromRichText(image.caption || []))}" />${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`
        : ''
      return `${imageHtml}${renderedChildren}`
    }
    case 'video': {
      const video = block?.video || {}
      const source = getFileBlockUrl(video)
      const caption = getHtmlFromRichText(video.caption || [])
      const media = source ? `<p><a href="${escapeHtml(source)}">${escapeHtml(getFileNameFromUrl(source))}</a></p>` : ''
      return `${media}${caption ? `<p>${caption}</p>` : ''}${renderedChildren}`
    }
    case 'audio': {
      const audio = block?.audio || {}
      const source = getFileBlockUrl(audio)
      const caption = getHtmlFromRichText(audio.caption || [])
      const media = source ? `<p><a href="${escapeHtml(source)}">${escapeHtml(getFileNameFromUrl(source))}</a></p>` : ''
      return `${media}${caption ? `<p>${caption}</p>` : ''}${renderedChildren}`
    }
    case 'pdf': {
      const pdf = block?.pdf || {}
      const source = getFileBlockUrl(pdf)
      const caption = getHtmlFromRichText(pdf.caption || [])
      const media = source ? `<p><a href="${escapeHtml(source)}">Open PDF</a></p>` : ''
      return `${media}${caption ? `<p>${caption}</p>` : ''}${renderedChildren}`
    }
    case 'embed': {
      const url = block?.embed?.url || ''
      const caption = getHtmlFromRichText(block?.embed?.caption || [])
      const link = url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''
      return `${link}${caption ? `<p>${caption}</p>` : ''}${renderedChildren}`
    }
    case 'bookmark': {
      const url = block?.bookmark?.url || ''
      const caption = getHtmlFromRichText(block?.bookmark?.caption || [])
      const link = url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''
      return `${link}${caption ? `<p>${caption}</p>` : ''}${renderedChildren}`
    }
    case 'file': {
      const file = block?.file || {}
      const url = getFileBlockUrl(file)
      const caption = getHtmlFromRichText(file.caption || [])
      const fileName = escapeHtml(getFileNameFromUrl(url))
      const link = url ? `<p><a href="${escapeHtml(url)}">${fileName}</a></p>` : ''
      return `${link}${caption ? `<p>${caption}</p>` : ''}${renderedChildren}`
    }
    case 'template': {
      const text = getHtmlFromRichText(block?.template?.rich_text || [])
      return `${text ? `<p>${text}</p>` : ''}${renderedChildren}`
    }
    case 'synced_block':
      return renderedChildren
    case 'child_page': {
      const title = `${block?.child_page?.title || ''}`.trim()
      return `${title ? `<p>${escapeHtml(title)}</p>` : ''}${renderedChildren}`
    }
    case 'child_database': {
      const title = `${block?.child_database?.title || ''}`.trim()
      return `${title ? `<p>${escapeHtml(title)}</p>` : ''}${renderedChildren}`
    }
    case 'link_to_page': {
      const label = getLinkToPageLabel(block?.link_to_page || {})
      return `<p>${escapeHtml(label)}</p>${renderedChildren}`
    }
    case 'table_of_contents':
    case 'breadcrumb':
      return renderedChildren
    case 'table': {
      const table = block?.table || {}
      const rowIds = childrenById[blockId] || []
      const rows = rowIds
        .map(id => blocksById[id])
        .filter((row: any) => row?.type === 'table_row')

      const widthFromSchema = Number(table.table_width) || 0
      const widthFromRows = rows.reduce((max: number, row: any) => {
        const cells = row?.table_row?.cells
        return Math.max(max, Array.isArray(cells) ? cells.length : 0)
      }, 0)
      const columnCount = Math.max(widthFromSchema, widthFromRows)

      if (!rows.length || !columnCount) return renderedChildren

      const body = rows.map((row: any, rowIndex: number) => {
        const cells = Array.isArray(row?.table_row?.cells) ? row.table_row.cells : []
        const rowHtml = Array.from({ length: columnCount }).map((_, colIndex: number) => {
          const cellRichText = cells[colIndex] || []
          const content = getHtmlFromRichText(cellRichText) || '&nbsp;'
          const isHeader = (!!table.has_column_header && rowIndex === 0) || (!!table.has_row_header && colIndex === 0)
          const tag = isHeader ? 'th' : 'td'
          return `<${tag}>${content}</${tag}>`
        }).join('')
        return `<tr>${rowHtml}</tr>`
      }).join('')

      return `<table><tbody>${body}</tbody></table>${renderedChildren}`
    }
    case 'table_row':
      return ''
    case 'link_preview': {
      const url = block?.link_preview?.url || ''
      const link = url ? `<p><a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>` : ''
      return `${link}${renderedChildren}`
    }
    case 'divider':
      return `<hr/>${renderedChildren}`
    case 'column':
    case 'column_list':
      return renderedChildren
    default:
      return renderedChildren
  }
}

function renderDocumentHtml(document: NotionDocument | null): string {
  if (!document) return ''
  const rootIds = document.rootIds || []
  const blocksById = document.blocksById || {}
  const childrenById = document.childrenById || {}

  return rootIds
    .map(rootId => renderBlockHtml(rootId, blocksById, childrenById))
    .filter(Boolean)
    .join('')
    .trim()
}

function fallbackFeedContent(post: PostData): FeedContentPayload {
  const summary = (post.summary || '').trim()
  return {
    html: `<p>${escapeHtml(summary)}</p>`
  }
}

const createFeedContent = async (post: PostData): Promise<FeedContentPayload> => {
  const document = await getCachedFeedDocument(post.id)
  if (!document) return fallbackFeedContent(post)

  const html = renderDocumentHtml(document)
  const fallback = fallbackFeedContent(post)

  return {
    html: html || fallback.html
  }
}

export async function generateRss(posts: PostData[], siteOrigin?: string): Promise<string> {
  const year = new Date().getFullYear()
  const siteUrl = resolveSiteUrl(siteOrigin)
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: siteUrl,
    link: siteUrl,
    language: config.lang,
    favicon: buildUrl(siteUrl, 'favicon.svg'),
    copyright: `All rights reserved ${year}, ${config.author}`,
    author: {
      name: config.author,
      email: config.email,
      link: siteUrl
    }
  })

  for (const post of posts) {
    const postUrl = buildUrl(siteUrl, post.slug)
    let content = fallbackFeedContent(post)

    try {
      content = await createFeedContent(post)
    } catch (error) {
      console.error(`[feed] Failed to render post content for ${post.slug}:`, error)
    }

    feed.addItem({
      title: post.title,
      id: postUrl,
      link: postUrl,
      description: (post.summary || '').trim(),
      content: content.html,
      date: new Date(post.date)
    })
  }

  return feed.rss2()
}
