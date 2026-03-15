import { escapeHtml } from '@jihuayu/notion-type'

export {
  buildInternalSlugHref,
  buildNotionPublicUrl,
  buildPageHrefMap,
  buildTableOfContents,
  escapeHtml,
  extractNotionPageIdFromUrl,
  getFileBlockName,
  getFileBlockUrl,
  getLinkToPageLabel,
  getPlainTextFromRichText,
  isInternalHref,
  normalizeCodeLanguage,
  normalizeNotionEntityId,
  normalizePreviewUrl,
  normalizeRichTextUrl,
  parseUrl,
  resolveEmbedIframeUrl,
  resolvePageHref,
  rewriteNotionPageHref
} from '@jihuayu/notion-type'
import type { LinkPreviewData, NotionTextAnnotations } from '../types'

export function getBlockClassName(blockId: string): string {
  return `notion-block-${blockId.replaceAll('-', '')}`
}

export function getHeadingAnchorId(blockId: string): string {
  return `notion-heading-${blockId.replaceAll('-', '')}`
}

export function getCalloutIconUrl(icon: unknown): string {
  if (!icon || typeof icon !== 'object') return ''
  const value = icon as Partial<{
    type: 'emoji' | 'external' | 'file'
    external: { url?: string }
    file: { url?: string }
  }>
  if (value.type === 'external') return value.external?.url || ''
  if (value.type === 'file') return value.file?.url || ''
  return ''
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
