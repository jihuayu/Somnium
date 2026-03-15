import type {
  NotionBlock,
  NotionDocument,
  NotionFileReference,
  NotionLinkToPageBlock,
  NotionRichText,
  PageHrefEntry,
  PageHrefMap,
  TocItem
} from '../types'

export function escapeHtml(input: string): string {
  return `${input || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getPlainTextFromRichText(richText: NotionRichText[] = [], trim = false): string {
  const text = richText.map(item => item?.plain_text || '').join('')
  return trim ? text.trim() : text
}

export function getFileBlockUrl(filePayload?: NotionFileReference | null): string {
  if (!filePayload || typeof filePayload !== 'object') return ''
  if (filePayload.type === 'external') return filePayload.external?.url || ''
  if (filePayload.type === 'file') return filePayload.file?.url || ''
  return filePayload.external?.url || filePayload.file?.url || ''
}

export function getLinkToPageLabel(linkToPage?: NotionLinkToPageBlock['link_to_page']): string {
  if (!linkToPage || typeof linkToPage !== 'object') return 'Linked page'
  switch (`${linkToPage.type || ''}`) {
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

export function normalizeRichTextUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    return new URL(url).toString()
  } catch {
    return ''
  }
}

export function normalizePreviewUrl(rawUrl: string): string | null {
  const trimmed = `${rawUrl || ''}`.trim()
  if (!trimmed) return null
  const normalized = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : /^(?:www\.)?[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(?::\d+)?(?:[/?#].*)?$/i.test(trimmed)
      ? `https://${trimmed}`
      : trimmed

  try {
    const parsed = new URL(normalized)
    if (!['http:', 'https:'].includes(parsed.protocol)) return null
    return parsed.toString()
  } catch {
    return null
  }
}

export function parseUrl(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    return new URL(url)
  } catch {
    return null
  }
}

export function decodePathSegment(segment: string): string {
  if (!segment) return ''
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

export function getFileBlockName(filePayload: { name?: string } | null | undefined, fileUrl: string): string {
  const explicitName = `${filePayload?.name || ''}`.trim()
  if (explicitName) return explicitName

  const parsed = parseUrl(fileUrl)
  if (!parsed) return 'File'

  const filename = decodePathSegment(parsed.pathname.split('/').filter(Boolean).pop() || '')
  if (filename) return filename
  return parsed.hostname || 'File'
}

export function resolveEmbedIframeUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace('www.', '')
    if (host === 'youtu.be') {
      const id = parsed.pathname.split('/').filter(Boolean)[0]
      return id ? `https://www.youtube.com/embed/${id}` : null
    }
    if (host.includes('youtube.com')) {
      const id = parsed.searchParams.get('v')
      if (id) return `https://www.youtube.com/embed/${id}`
      if (parsed.pathname.startsWith('/embed/')) return url
    }
  } catch {
    return null
  }
  return null
}

export function normalizeNotionEntityId(rawId?: string): string {
  const compact = `${rawId || ''}`.trim().replaceAll('-', '').toLowerCase()
  return /^[0-9a-f]{32}$/.test(compact) ? compact : ''
}

function trimSlashes(value: string): string {
  return `${value || ''}`.trim().replace(/^\/+|\/+$/g, '')
}

export function buildInternalSlugHref(basePath: string, slug: string): string {
  const normalizedBase = trimSlashes(basePath)
  const normalizedSlug = trimSlashes(slug)
  if (!normalizedSlug) return normalizedBase ? `/${normalizedBase}` : '/'
  return normalizedBase ? `/${normalizedBase}/${normalizedSlug}` : `/${normalizedSlug}`
}

export function buildPageHrefMap(entries: PageHrefEntry[], basePath = ''): PageHrefMap {
  const map: PageHrefMap = {}
  for (const entry of entries || []) {
    const key = normalizeNotionEntityId(entry?.id)
    const slug = `${entry?.slug || ''}`.trim()
    if (!key || !slug) continue
    map[key] = buildInternalSlugHref(basePath, slug)
  }
  return map
}

export function buildNotionPublicUrl(rawId: string): string {
  const normalized = normalizeNotionEntityId(rawId)
  return normalized ? `https://www.notion.so/${normalized}` : ''
}

export function resolvePageHref(rawId: string, pageHrefMap: PageHrefMap): string {
  const normalized = normalizeNotionEntityId(rawId)
  if (!normalized) return ''
  return pageHrefMap[normalized] || buildNotionPublicUrl(normalized)
}

export function extractNotionPageIdFromUrl(rawUrl?: string | null): string {
  const parsed = parseUrl(rawUrl)
  if (!parsed) return ''

  const hostname = parsed.hostname.toLowerCase()
  if (hostname !== 'notion.so' && hostname !== 'www.notion.so') return ''

  const uuidLikePattern = /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/ig
  const candidates = [parsed.pathname, ...parsed.pathname.split('/').filter(Boolean).map(decodePathSegment)]

  for (const candidate of candidates) {
    const matches = candidate.match(uuidLikePattern) || []
    for (const match of matches.reverse()) {
      const normalized = normalizeNotionEntityId(match)
      if (normalized) return normalized
    }
  }

  return ''
}

export function rewriteNotionPageHref(rawHref: string | null | undefined, pageHrefMap: PageHrefMap): string {
  const href = `${rawHref || ''}`.trim()
  if (!href) return ''
  const notionPageId = extractNotionPageIdFromUrl(href)
  if (!notionPageId) return href
  return pageHrefMap[notionPageId] || href
}

export function isInternalHref(href: string | null | undefined): boolean {
  const value = `${href || ''}`.trim()
  return value.startsWith('/')
}

function getBlockRichText(block: NotionBlock): NotionRichText[] {
  switch (block.type) {
    case 'heading_1':
      return block.heading_1.rich_text
    case 'heading_2':
      return block.heading_2.rich_text
    case 'heading_3':
      return block.heading_3.rich_text
    default:
      return []
  }
}

export function buildTableOfContents(document: NotionDocument): TocItem[] {
  const headingLevel: Record<string, number> = {
    heading_1: 0,
    heading_2: 1,
    heading_3: 2
  }

  const toc: TocItem[] = []
  const walk = (blockIds: string[] = []) => {
    for (const blockId of blockIds) {
      const block = document.blocksById[blockId]
      if (!block) continue

      if (Object.prototype.hasOwnProperty.call(headingLevel, block.type)) {
        const text = getPlainTextFromRichText(getBlockRichText(block), true)
        if (text) {
          toc.push({
            id: block.id,
            text,
            indentLevel: headingLevel[block.type]
          })
        }
      }

      walk(document.childrenById[blockId] || [])
    }
  }

  walk(document.rootIds || [])
  return toc
}

export function normalizeCodeLanguage(rawLanguage: string): string {
  const aliases: Record<string, string> = {
    js: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    ts: 'typescript',
    mts: 'typescript',
    cts: 'typescript',
    sh: 'bash',
    shell: 'bash',
    shellscript: 'bash',
    yml: 'yaml',
    py: 'python',
    plain: 'plaintext',
    text: 'plaintext',
    txt: 'plaintext'
  }
  const lower = `${rawLanguage || ''}`.trim().toLowerCase()
  if (!lower) return ''
  return aliases[lower] || lower
}

export function renderFallbackHighlightedCodeHtml(source: string): string {
  return `<pre><code>${escapeHtml(source)}</code></pre>`
}

