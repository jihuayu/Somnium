import { Feed } from 'feed'
import { unstable_cache } from 'next/cache'
import { config } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'
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

async function buildFeedDocument(pageId: string): Promise<NotionDocument | null> {
  if (!pageId) return null

  const blocksById: Record<string, any> = {}
  const childrenById: Record<string, string[]> = {}

  async function walk(parentId: string) {
    const children = await api.listAllBlockChildren(parentId)
    childrenById[parentId] = children.map((block: any) => block.id)

    for (const block of children) {
      blocksById[block.id] = block
      if (block.has_children) {
        await walk(block.id)
      }
    }
  }

  await walk(pageId)

  return {
    pageId,
    rootIds: childrenById[pageId] || [],
    blocksById,
    childrenById,
    toc: []
  }
}

const getCachedFeedDocument = unstable_cache(
  async (postId: string) => buildFeedDocument(postId),
  ['feed-post-blocks-v3'],
  { revalidate: FEED_POST_BLOCKS_CACHE_SECONDS, tags: ['feed-post-blocks'] }
)

interface FeedContentPayload {
  html: string
  markdown: string
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

function getMarkdownFromRichText(richText: any[] = []): string {
  return richText
    .map(item => {
      const raw = item?.type === 'equation'
        ? item?.equation?.expression || ''
        : item?.plain_text || ''
      const text = raw.replace(/\r?\n/g, ' ').trim()
      if (!text) return ''

      const annotations = item?.annotations || {}
      let output = text

      if (annotations.code) output = `\`${output.replaceAll('`', '\\`')}\``
      if (annotations.bold) output = `**${output}**`
      if (annotations.italic) output = `*${output}*`
      if (annotations.strikethrough) output = `~~${output}~~`
      if (annotations.underline) output = `<u>${output}</u>`

      const href = item?.href || item?.text?.link?.url || null
      if (href) output = `[${output}](${href})`

      return output
    })
    .join('')
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

      const href = item?.href || item?.text?.link?.url || null
      if (href) output = `<a href="${escapeHtml(href)}">${output}</a>`

      return output
    })
    .join('')
}

function renderBlockMarkdown(
  blockId: string,
  blocksById: Record<string, any>,
  childrenById: Record<string, string[]>,
  listDepth = 0
): string {
  const block = blocksById[blockId]
  if (!block) return ''

  const childIds = childrenById[blockId] || []
  const renderChildren = (nextListDepth = listDepth) =>
    childIds
      .map(childId => renderBlockMarkdown(childId, blocksById, childrenById, nextListDepth))
      .filter(Boolean)
      .join('\n\n')

  switch (block.type) {
    case 'paragraph': {
      const paragraph = getMarkdownFromRichText(block?.paragraph?.rich_text || [])
      return [paragraph, renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'heading_1':
    case 'heading_2':
    case 'heading_3': {
      const level = block.type === 'heading_1' ? '#' : block.type === 'heading_2' ? '##' : '###'
      const heading = getMarkdownFromRichText(block?.[block.type]?.rich_text || [])
      return [`${level} ${heading}`.trim(), renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'quote': {
      const quoteText = getMarkdownFromRichText(block?.quote?.rich_text || [])
      const quote = quoteText
        ? quoteText.split('\n').map((line: string) => `> ${line}`).join('\n')
        : ''
      return [quote, renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'bulleted_list_item': {
      const bulletText = getMarkdownFromRichText(block?.bulleted_list_item?.rich_text || [])
      const bulletPrefix = `${'  '.repeat(listDepth)}- `
      const bulletLine = `${bulletPrefix}${bulletText}`.trimEnd()
      const childList = childIds
        .map(childId => renderBlockMarkdown(childId, blocksById, childrenById, listDepth + 1))
        .filter(Boolean)
        .join('\n')
      return childList ? `${bulletLine}\n${childList}` : bulletLine
    }
    case 'code': {
      const code = block?.code || {}
      const language = code.language && code.language !== 'plain text' ? code.language : ''
      const source = getPlainTextFromRichText(code.rich_text || [], false)
      const fenced = `\`\`\`${language}\n${source}\n\`\`\``
      return [fenced, renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'image': {
      const image = block?.image || {}
      const source = image.type === 'external'
        ? image?.external?.url
        : image?.file?.url
      const caption = getMarkdownFromRichText(image.caption || [])
      const imageLine = source ? `![${caption || 'image'}](${source})` : ''
      return [imageLine, renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'embed': {
      const embed = block?.embed || {}
      const url = embed.url || ''
      const caption = getMarkdownFromRichText(embed.caption || [])
      const link = url ? `[${url}](${url})` : ''
      return [link, caption, renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'bookmark': {
      const bookmark = block?.bookmark || {}
      const url = bookmark.url || ''
      const caption = getMarkdownFromRichText(bookmark.caption || [])
      const link = url ? `[${url}](${url})` : ''
      return [link, caption, renderChildren(listDepth)].filter(Boolean).join('\n\n')
    }
    case 'column':
    case 'column_list':
      return renderChildren(listDepth)
    case 'divider':
      return ['---', renderChildren(listDepth)].filter(Boolean).join('\n\n')
    default:
      return renderChildren(listDepth)
  }
}

function renderDocumentMarkdown(document: NotionDocument | null): string {
  if (!document) return ''

  const rootIds = document.rootIds || []
  const blocksById = document.blocksById || {}
  const childrenById = document.childrenById || {}

  return rootIds
    .map(rootId => renderBlockMarkdown(rootId, blocksById, childrenById))
    .filter(Boolean)
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
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
    case 'code': {
      const code = block?.code || {}
      const source = escapeHtml(getPlainTextFromRichText(code.rich_text || [], false))
      const language = code.language ? ` class="language-${escapeHtml(code.language)}"` : ''
      return `<pre><code${language}>${source}</code></pre>${renderedChildren}`
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
  const markdown = (post.summary || '').trim()
  return {
    markdown,
    html: `<p>${escapeHtml(markdown)}</p>`
  }
}

const createFeedContent = async (post: PostData): Promise<FeedContentPayload> => {
  const document = await getCachedFeedDocument(post.id)
  if (!document) return fallbackFeedContent(post)

  const html = renderDocumentHtml(document)
  const markdown = renderDocumentMarkdown(document)
  const fallback = fallbackFeedContent(post)

  return {
    html: html || fallback.html,
    markdown: markdown || fallback.markdown
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
      description: content.markdown || post.summary || '',
      content: content.html,
      date: new Date(post.date)
    })
  }

  return feed.rss2()
}
