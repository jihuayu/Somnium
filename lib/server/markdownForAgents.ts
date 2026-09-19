import { config } from '@/lib/server/config'
import { buildSiteAbsoluteUrl, buildSiteOrigin, buildSiteRelativePath } from '@/lib/server/sitemap'
import { getAllPosts, getAllTagsFromPosts, getPostBlocks } from '@/lib/notion'
import { formatDate } from '@/lib/formatDate'
import { decodePossiblyEncoded } from '@/lib/url/decodePossiblyEncoded'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { NotionBlock, NotionDocument, NotionRichText } from '@jihuayu/notion-type'
import { buildProfileMarkdown, ME_PAGE_SLUG } from '@/lib/profile'

function absolute(path: string): string {
  return buildSiteAbsoluteUrl(
    buildSiteOrigin(config.link || ''),
    buildSiteRelativePath(config.path || '', path)
  )
}

function escapeMarkdown(value: string): string {
  return `${value || ''}`.replace(/[\\`*_{}[\]()#+\-.!|>]/g, '\\$&')
}

function escapeTableCell(value: string): string {
  return escapeMarkdown(value).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

function richTextPlainText(items: NotionRichText[] = []): string {
  return items.map(item => item.plain_text || '').join('')
}

function richTextToMarkdown(items: NotionRichText[] = []): string {
  return items.map(item => {
    let text = escapeMarkdown(item.plain_text || '')
    const textPayload = item.type === 'text'
      ? item.text as { link?: { url?: string } | null } | undefined
      : undefined
    const href = item.href || textPayload?.link?.url
    const annotations = item.annotations || {}

    if (annotations.code) text = `\`${text.replace(/`/g, '\\`')}\``
    if (annotations.bold) text = `**${text}**`
    if (annotations.italic) text = `_${text}_`
    if (annotations.strikethrough) text = `~~${text}~~`
    if (href) text = `[${text}](${href})`
    return text
  }).join('')
}

function fileUrl(file: { external?: { url?: string }, file?: { url?: string } } = {}): string {
  return file.external?.url || file.file?.url || ''
}

function childrenMarkdown(document: NotionDocument, blockId: string): string {
  return (document.childrenById[blockId] || [])
    .map(childId => blockToMarkdown(document, childId))
    .filter(Boolean)
    .join('\n\n')
}

function withChildren(document: NotionDocument, block: NotionBlock, content: string): string {
  const childContent = childrenMarkdown(document, block.id)
  return [content, childContent].filter(Boolean).join('\n\n')
}

function renderTable(document: NotionDocument, block: Extract<NotionBlock, { type: 'table' }>): string {
  const rows = (document.childrenById[block.id] || [])
    .map(rowId => document.blocksById[rowId])
    .filter((row): row is Extract<NotionBlock, { type: 'table_row' }> => row?.type === 'table_row')
  if (!rows.length) return ''

  const cells = rows.map(row => row.table_row.cells.map(cell => escapeTableCell(richTextPlainText(cell))))
  const width = Math.max(block.table.table_width || 0, ...cells.map(row => row.length))
  const normalize = (row: string[]) => Array.from({ length: width }, (_, index) => row[index] || '')
  const [first, ...rest] = cells.map(normalize)
  const header = block.table.has_column_header ? first : Array.from({ length: width }, (_, index) => `Column ${index + 1}`)
  const body = block.table.has_column_header ? rest : [first, ...rest]

  return [
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map(row => `| ${row.join(' | ')} |`)
  ].join('\n')
}

function renderTableOfContents(document: NotionDocument): string {
  return (document.toc || [])
    .map(item => `${'  '.repeat(Math.max(0, item.indentLevel - 1))}- ${escapeMarkdown(item.text)}`)
    .join('\n')
}

function blockToMarkdown(document: NotionDocument, blockId: string): string {
  const block = document.blocksById[blockId]
  if (!block) return ''

  switch (block.type) {
    case 'paragraph':
      return withChildren(document, block, richTextToMarkdown(block.paragraph.rich_text))
    case 'heading_1':
      return `# ${richTextToMarkdown(block.heading_1.rich_text)}`
    case 'heading_2':
      return `## ${richTextToMarkdown(block.heading_2.rich_text)}`
    case 'heading_3':
      return `### ${richTextToMarkdown(block.heading_3.rich_text)}`
    case 'quote':
      return `> ${richTextToMarkdown(block.quote.rich_text)}`
    case 'callout': {
      const icon = block.callout.icon?.type === 'emoji' ? `${block.callout.icon.emoji} ` : ''
      return withChildren(document, block, `> ${icon}${richTextToMarkdown(block.callout.rich_text)}`)
    }
    case 'equation':
      return `$$\n${block.equation.expression || ''}\n$$`
    case 'code':
      return `\`\`\`${block.code.language || ''}\n${richTextPlainText(block.code.rich_text)}\n\`\`\``
    case 'image': {
      const caption = richTextPlainText(block.image.caption || []) || 'Image'
      const url = fileUrl(block.image)
      return url ? `![${escapeMarkdown(caption)}](${url})` : ''
    }
    case 'embed':
      return `[${escapeMarkdown(block.embed.url)}](${block.embed.url})`
    case 'bookmark':
      return `[${escapeMarkdown(block.bookmark.url)}](${block.bookmark.url})`
    case 'video':
    case 'audio':
    case 'pdf':
    case 'file': {
      const payload = block[block.type]
      const url = fileUrl(payload)
      const label = richTextPlainText(payload.caption || []) || payload.name || block.type
      return url ? `[${escapeMarkdown(label)}](${url})` : ''
    }
    case 'divider':
      return '---'
    case 'bulleted_list_item':
      return withChildren(document, block, `- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`)
    case 'numbered_list_item':
      return withChildren(document, block, `1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`)
    case 'to_do':
      return withChildren(document, block, `- [${block.to_do.checked ? 'x' : ' '}] ${richTextToMarkdown(block.to_do.rich_text)}`)
    case 'toggle':
      return withChildren(document, block, `- ${richTextToMarkdown(block.toggle.rich_text)}`)
    case 'template':
      return withChildren(document, block, richTextToMarkdown(block.template.rich_text))
    case 'child_page':
      return `- ${escapeMarkdown(block.child_page.title)}`
    case 'child_database':
      return `- ${escapeMarkdown(block.child_database.title)}`
    case 'link_preview':
      return `[${escapeMarkdown(block.link_preview.url)}](${block.link_preview.url})`
    case 'table':
      return renderTable(document, block)
    case 'table_of_contents':
      return renderTableOfContents(document)
    case 'column':
    case 'column_list':
    case 'synced_block':
      return childrenMarkdown(document, block.id)
    default:
      return childrenMarkdown(document, block.id)
  }
}

function documentToMarkdown(document: NotionDocument): string {
  return document.rootIds.map(blockId => blockToMarkdown(document, blockId)).filter(Boolean).join('\n\n')
}

function postListMarkdown(posts: PostData[]): string[] {
  return posts.flatMap(post => [
    `- [${escapeMarkdown(post.title)}](${absolute(`/${post.slug}`)}) — ${formatDate(post.date, config.lang, config.timezone)}`,
    post.summary ? `  ${escapeMarkdown(post.summary)}` : ''
  ].filter(Boolean))
}

async function homeMarkdown(): Promise<string> {
  const posts = await getAllPosts({ includePages: false })
  const postsToShow = posts.slice(0, config.postsPerPage)
  const showNext = posts.length > config.postsPerPage
  return [
    `# ${escapeMarkdown(config.title)}`,
    '',
    escapeMarkdown(config.description || ''),
    '',
    `Canonical URL: ${absolute('/')}`,
    '',
    '## Recent posts',
    '',
    ...postListMarkdown(postsToShow),
    ...(showNext ? ['', `[Next page](${absolute('/page/2')})`] : []),
    '',
    '## Agent resources',
    '',
    '- [API catalog](/.well-known/api-catalog)',
    '- [OpenAPI description](/.well-known/openapi.json)',
    '- [API documentation](/docs/api)',
    '- [Agent skills index](/.well-known/agent-skills/index.json)',
    '- [MCP server card](/.well-known/mcp/server-card.json)',
    '- [RSS feed](/feed)'
  ].join('\n')
}

async function paginatedMarkdown(pageNumber: number): Promise<string | null> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) return null
  const posts = await getAllPosts({ includePages: false })
  const postsToShow = posts.slice(config.postsPerPage * (pageNumber - 1), config.postsPerPage * pageNumber)
  if (!postsToShow.length) return null
  const showNext = pageNumber * config.postsPerPage < posts.length
  return [
    `# ${escapeMarkdown(config.title)} — Page ${pageNumber}`,
    '',
    ...postListMarkdown(postsToShow),
    '',
    pageNumber > 1 ? `[Previous page](${absolute(pageNumber === 2 ? '/' : `/page/${pageNumber - 1}`)})` : '',
    showNext ? `[Next page](${absolute(`/page/${pageNumber + 1}`)})` : ''
  ].filter(Boolean).join('\n')
}

async function tagMarkdown(tagPath: string): Promise<string> {
  const currentTag = decodePossiblyEncoded(tagPath)
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  const filteredPosts = posts.filter(post => post.tags?.includes(currentTag))
  return [
    `# Posts tagged ${escapeMarkdown(currentTag)}`,
    '',
    `${filteredPosts.length} post${filteredPosts.length === 1 ? '' : 's'} found.`,
    '',
    ...postListMarkdown(filteredPosts),
    '',
    '## All tags',
    '',
    ...Object.entries(tags).map(([tag, count]) => `- [${escapeMarkdown(tag)}](${absolute(`/tag/${encodeURIComponent(tag)}`)}) (${count})`)
  ].join('\n')
}

async function searchMarkdown(): Promise<string> {
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  return [
    '# Search',
    '',
    'Use the public search API to search blog posts:',
    '',
    '```http',
    'GET /api/search?q={query}&limit={limit}',
    '```',
    '',
    '## Recent posts',
    '',
    ...postListMarkdown(posts.slice(0, config.postsPerPage)),
    '',
    '## Tags',
    '',
    ...Object.entries(tags).map(([tag, count]) => `- [${escapeMarkdown(tag)}](${absolute(`/tag/${encodeURIComponent(tag)}`)}) (${count})`)
  ].join('\n')
}

async function meMarkdown(): Promise<string> {
  const posts = await getAllPosts({ includePages: false })
  const profile = config.profile
  const recentCount = Math.max(1, Math.floor(profile.recentPostCount) || 5)
  return buildProfileMarkdown({
    name: escapeMarkdown(profile.name || config.author),
    tagline: escapeMarkdown(profile.tagline || config.description || ''),
    quote: escapeMarkdown(profile.quote || ''),
    canonicalUrl: absolute(`/${ME_PAGE_SLUG}`),
    postsHeading: 'Recent writing',
    posts: posts.slice(0, recentCount).map(post => ({
      title: escapeMarkdown(post.title),
      href: absolute(`/${post.slug}`),
      date: formatDate(post.date, config.lang, config.timezone),
      summary: post.summary ? escapeMarkdown(post.summary) : undefined
    }))
  })
}

async function postMarkdown(slug: string): Promise<string | null> {
  const posts = await getAllPosts({ includePages: true })
  const post = posts.find(row => row.slug === slug)
  if (!post) return null
  const document = await getPostBlocks(post.id)
  if (!document) return null
  const body = documentToMarkdown(document)
  return [
    `# ${escapeMarkdown(post.title)}`,
    '',
    `Published: ${formatDate(post.date, config.lang, config.timezone)}`,
    post.tags?.length ? `Tags: ${post.tags.map(escapeMarkdown).join(', ')}` : '',
    '',
    post.summary ? `> ${escapeMarkdown(post.summary)}` : '',
    '',
    body,
    '',
    `Canonical URL: ${absolute(`/${post.slug}`)}`
  ].filter(line => line !== '').join('\n')
}

export async function markdownForAgentPath(path: string[] = []): Promise<string | null> {
  if (!path.length) return homeMarkdown()
  if (path[0] === 'page' && path.length === 2) return paginatedMarkdown(Number(path[1]))
  if (path[0] === 'tag' && path.length === 2) return tagMarkdown(path[1])
  if (path[0] === 'search' && path.length === 1) return searchMarkdown()
  if (path[0] === ME_PAGE_SLUG && path.length === 1) return meMarkdown()
  if (path.length === 1) return postMarkdown(decodePossiblyEncoded(path[0]))
  return null
}
