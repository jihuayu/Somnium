import type {
  LinkPreviewData,
  NotionBlock,
  NotionDocument,
  NotionFileReference,
  NotionLinkToPageBlock,
  NotionRichText,
  PageHrefEntry,
  PageHrefMap,
  NotionTextAnnotations,
  ResolvedNotionRenderOptions,
  TocItem
} from '../types'

export const DEFAULT_RENDER_OPTIONS: ResolvedNotionRenderOptions = {
  locale: 'zh-CN',
  timeZone: '',
  dateMention: {
    displayMode: 'relative',
    includeTime: 'always',
    absoluteDateFormat: 'YYYY年M月D日',
    absoluteDateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
    relativeStyle: 'short'
  }
}

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
  try { return new URL(url).toString() } catch { return '' }
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
  try { return new URL(url) } catch { return null }
}

export function decodePathSegment(segment: string): string {
  if (!segment) return ''
  try { return decodeURIComponent(segment) } catch { return segment }
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

export function getBlockClassName(blockId: string): string {
  return `notion-block-${blockId.replaceAll('-', '')}`
}

export function getHeadingAnchorId(blockId: string): string {
  return `notion-heading-${blockId.replaceAll('-', '')}`
}

export function getCalloutIconUrl(icon: unknown): string {
  if (!icon || typeof icon !== 'object') return ''
  const value = icon as {
    type?: string
    external?: { url?: string }
    file?: { url?: string }
  }
  if (value.type === 'external') return value.external?.url || ''
  if (value.type === 'file') return value.file?.url || ''
  return ''
}

function getBlockRichText(block: NotionBlock): NotionRichText[] {
  if (!block || !block.type) return []
  const payload = block[block.type] as { rich_text?: NotionRichText[] } | undefined
  return payload?.rich_text || []
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
  return `<pre class="shiki shiki-themes github-light github-dark" style="color:#24292e;background-color:#fff;--shiki-light:#24292e;--shiki-light-bg:#fff;--shiki-dark:#e1e4e8;--shiki-dark-bg:#24292e"><code>${escapeHtml(source)}</code></pre>`
}

export function getAnnotationColorClasses(annotations: NotionTextAnnotations | undefined): {
  textColorClassName: string
  backgroundColorClassName: string
} {
  const textColorMap: Record<string, string> = {
    gray: 'notion-color-gray',
    brown: 'notion-color-brown',
    orange: 'notion-color-orange',
    yellow: 'notion-color-yellow',
    green: 'notion-color-green',
    teal: 'notion-color-green',
    blue: 'notion-color-blue',
    purple: 'notion-color-purple',
    pink: 'notion-color-pink',
    red: 'notion-color-red'
  }
  const backgroundColorMap: Record<string, string> = {
    gray_background: 'notion-color-gray-bg',
    brown_background: 'notion-color-brown-bg',
    orange_background: 'notion-color-orange-bg',
    yellow_background: 'notion-color-yellow-bg',
    green_background: 'notion-color-green-bg',
    teal_background: 'notion-color-green-bg',
    blue_background: 'notion-color-blue-bg',
    purple_background: 'notion-color-purple-bg',
    pink_background: 'notion-color-pink-bg',
    red_background: 'notion-color-red-bg'
  }

  const normalizeToken = (value: unknown) => {
    if (typeof value !== 'string') return ''
    const normalized = value.trim().toLowerCase()
    return normalized && normalized !== 'default' ? normalized : ''
  }

  const findMatch = (candidates: unknown[], table: Record<string, string>, background = false) => {
    for (const candidate of candidates) {
      const token = normalizeToken(candidate)
      if (!token) continue
      const normalized = background && !token.endsWith('_background') ? `${token}_background` : token
      if (table[normalized]) return table[normalized]
    }
    return ''
  }

  const legacy = normalizeToken(annotations?.color)
  return {
    textColorClassName: findMatch([
      annotations?.text_color,
      annotations?.foreground_color,
      annotations?.font_color,
      legacy && !legacy.endsWith('_background') ? legacy : ''
    ], textColorMap),
    backgroundColorClassName: findMatch([
      annotations?.background_color,
      annotations?.bg_color,
      annotations?.highlight_color,
      annotations?.background,
      legacy && legacy.endsWith('_background') ? legacy : ''
    ], backgroundColorMap, true)
  }
}

export function buildFallbackLinkPreview(url: string): LinkPreviewData {
  if (!url) {
    return { url: '', hostname: '', title: '', description: '', image: '', icon: '' }
  }

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    return {
      url: parsed.toString(),
      hostname,
      title: hostname,
      description: '',
      image: '',
      icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    }
  } catch {
    return { url, hostname: '', title: url, description: '', image: '', icon: '' }
  }
}
