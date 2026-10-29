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
  getLinkPreviewPresentation,
  getUrlMentionLabel,
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

const OG_PROXY_IMAGE_URL = 'https://og-proxy.raw2.cc/proxy/image'
const OG_PROXY_IMAGE_HOSTNAME = 'og-proxy.raw2.cc'
const OG_PROXY_IMAGE_PATHNAME = '/proxy/image'
const OG_PROXY_IMAGE_TRANSFORM_PARAMS = ['q', 'f', 'fit']

export interface OgProxyImageOptions {
  format?: 'png' | 'jpeg' | 'webp'
  quality?: number
}

function applyOgProxyImageTransforms(parsed: URL, options?: OgProxyImageOptions) {
  for (const param of OG_PROXY_IMAGE_TRANSFORM_PARAMS) {
    parsed.searchParams.delete(param)
  }
  if (options?.format) parsed.searchParams.set('f', options.format)
  if (typeof options?.quality === 'number') parsed.searchParams.set('q', String(options.quality))
}

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
  if (value.type === 'external') return toOgProxyImageUrl(value.external?.url || '')
  if (value.type === 'file') return toOgProxyImageUrl(value.file?.url || '')
  return ''
}

export function toOgProxyImageUrl(rawImageUrl: string, referer = '', options?: OgProxyImageOptions): string {
  if (!rawImageUrl) return ''

  try {
    const parsed = new URL(rawImageUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return rawImageUrl

    if (parsed.hostname === OG_PROXY_IMAGE_HOSTNAME && parsed.pathname === OG_PROXY_IMAGE_PATHNAME) {
      applyOgProxyImageTransforms(parsed, options)
      return parsed.toString()
    }

    const proxyUrl = new URL(OG_PROXY_IMAGE_URL)
    proxyUrl.searchParams.set('url', parsed.toString())
    if (referer) proxyUrl.searchParams.set('referer', referer)
    applyOgProxyImageTransforms(proxyUrl, options)
    return proxyUrl.toString()
  } catch {
    return rawImageUrl
  }
}

export function toOgProxyPreviewImageUrl(rawImageUrl: string, referer = ''): string {
  return toOgProxyImageUrl(rawImageUrl, referer, { format: 'png' })
}

export function renderFallbackHighlightedCodeHtml(source: string): string {
  return `<pre class="shiki shiki-themes vitesse-light vitesse-dark" style="color:#4a4a4a;background-color:#ffffff;--shiki-light:#4a4a4a;--shiki-light-bg:#ffffff;--shiki-dark:#dbd7ca;--shiki-dark-bg:#1b1b1b"><code>${escapeHtml(source)}</code></pre>`
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
    const icon = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    return {
      url: parsed.toString(),
      hostname,
      title: hostname,
      description: '',
      image: '',
      icon: toOgProxyImageUrl(icon, parsed.toString())
    }
  } catch {
    return { url, hostname: '', title: url, description: '', image: '', icon: '' }
  }
}
