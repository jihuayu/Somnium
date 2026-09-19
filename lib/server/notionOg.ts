import cjk from '@/lib/cjk'
import { getAllPosts } from '@/lib/notion/getAllPosts'
import { collectNormalizedPostIds } from '@/lib/notion/postAdapter'
import { mapPageToOgData, normalizeNotionUuid, type PageOgData } from '@jihuayu/notion-data'
import { unstable_cache } from 'next/cache'
import { parsePublicHttpUrl } from './url'
import { config } from './config'
import { notionClient } from './notionData'

const NOTION_OG_PAGE_CACHE_REVALIDATE_SECONDS = 300
const FONT_CACHE_REVALIDATE_SECONDS = 60 * 60 * 24 * 30
const MAX_OG_COVER_BYTES = 8 * 1024 * 1024
const OG_COVER_FETCH_TIMEOUT_MS = 5000
const GOOGLE_FONTS_USER_AGENT =
  'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1'
const SUPPORTED_OG_FONT_FORMATS = new Set(['opentype', 'truetype', 'woff'])

interface OgFontDescriptor {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal'
}

const getCachedOgPage = unstable_cache(
  async (pageId: string) => {
    const page = await notionClient.retrievePage(pageId)
    return mapPageToOgData(page)
  },
  ['notion-og-page'],
  { revalidate: NOTION_OG_PAGE_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts', 'notion-og-page'] }
)

const getCachedPublishedOgPageIds = unstable_cache(
  async () => {
    const posts = await getAllPosts({ includePages: true })
    return collectNormalizedPostIds(posts)
  },
  ['notion-og-page-allowlist'],
  { revalidate: NOTION_OG_PAGE_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts', 'notion-og-page'] }
)

export function resolveOgFontFamily(): string {
  const cjkVariant = cjk(config)
  switch (cjkVariant) {
    case 'SC':
      return 'Noto Serif SC'
    case 'TC':
      return 'Noto Serif TC'
    case 'JP':
      return 'Noto Serif JP'
    case 'KR':
      return 'Noto Serif KR'
    default:
      return 'Source Serif 4'
  }
}

function buildFontSubsetText(parts: string[]): string {
  const seen = new Set<string>()
  let output = ''

  for (const part of parts) {
    for (const char of `${part || ''}`) {
      if (seen.has(char)) continue
      seen.add(char)
      output += char
      if (output.length >= 256) {
        return output
      }
    }
  }

  return output
}

function normalizeCssUrl(value: string): string {
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export function resolveRenderableGoogleFontUrl(css: string): string | null {
  const matches = css.matchAll(/src:\s*url\(([^)]+)\)\s*format\((['"])([^'"]+)\2\)/gi)

  for (const match of matches) {
    const format = `${match[3] || ''}`.toLowerCase()
    if (SUPPORTED_OG_FONT_FORMATS.has(format)) {
      return normalizeCssUrl(match[1] || '')
    }
  }

  return null
}

function isRenderableOgFontData(data: ArrayBuffer): boolean {
  const bytes = Buffer.from(data)
  if (bytes.byteLength < 4) return false

  const signature = bytes.subarray(0, 4).toString('latin1')
  if (signature === '\u0000\u0001\u0000\u0000' || signature === 'true' || signature === 'typ1' || signature === 'OTTO') {
    return true
  }

  if (signature !== 'wOFF' || bytes.byteLength < 8) {
    return false
  }

  const flavor = bytes.subarray(4, 8).toString('latin1')
  return flavor === '\u0000\u0001\u0000\u0000' || flavor === 'OTTO'
}

const getCachedFontBase64 = unstable_cache(
  async (family: string, text: string, weight: 400 | 700) => {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&text=${encodeURIComponent(text)}`
    const cssResponse = await fetch(cssUrl, {
      headers: {
        'User-Agent': GOOGLE_FONTS_USER_AGENT
      }
    })

    if (!cssResponse.ok) {
      throw new Error(`Failed to fetch font stylesheet for ${family} (${weight})`)
    }

    const css = await cssResponse.text()
    const fontUrl = resolveRenderableGoogleFontUrl(css)
    if (!fontUrl) {
      throw new Error(`Failed to resolve renderable font URL for ${family} (${weight})`)
    }

    const fontResponse = await fetch(fontUrl)
    if (!fontResponse.ok) {
      throw new Error(`Failed to fetch font data for ${family} (${weight})`)
    }

    const fontData = await fontResponse.arrayBuffer()
    if (!isRenderableOgFontData(fontData)) {
      throw new Error(`Fetched unsupported font data for ${family} (${weight})`)
    }

    return Buffer.from(fontData).toString('base64')
  },
  ['notion-og-font-renderable-v1'],
  { revalidate: FONT_CACHE_REVALIDATE_SECONDS }
)

function decodeBase64ToArrayBuffer(value: string): ArrayBuffer {
  const bytes = Buffer.from(value, 'base64')
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

export async function getPageOgData(pageId: string): Promise<PageOgData | null> {
  const normalizedPageId = normalizeNotionUuid(pageId)
  if (!normalizedPageId) return null
  return getCachedOgPage(normalizedPageId)
}

export async function getPublishedPageOgData(pageId: string): Promise<PageOgData | null> {
  const normalizedPageId = normalizeNotionUuid(pageId)
  if (!normalizedPageId) return null

  const publishedPageIds = await getCachedPublishedOgPageIds()
  if (!publishedPageIds.includes(normalizedPageId)) {
    return null
  }

  return getCachedOgPage(normalizedPageId)
}

export async function resolvePublishedPageOgData(
  pageId: string,
  dependencies: {
    getPublishedPageOgData?: (pageId: string) => Promise<PageOgData | null>
    getPageOgData?: (pageId: string) => Promise<PageOgData | null>
    onPublishedLookupError?: (error: unknown) => void
  } = {}
): Promise<PageOgData | null> {
  const loadPublishedPageOgData = dependencies.getPublishedPageOgData || getPublishedPageOgData
  const loadPageOgData = dependencies.getPageOgData || getPageOgData

  try {
    return await loadPublishedPageOgData(pageId)
  } catch (error) {
    dependencies.onPublishedLookupError?.(error)
    return loadPageOgData(pageId)
  }
}

export async function loadOgFonts(parts: string[]): Promise<OgFontDescriptor[]> {
  const family = resolveOgFontFamily()
  const text = buildFontSubsetText(parts)
  if (!text) return []

  const [regularBase64, boldBase64] = await Promise.all([
    getCachedFontBase64(family, text, 400),
    getCachedFontBase64(family, text, 700)
  ])

  const regularData = decodeBase64ToArrayBuffer(regularBase64)
  const boldData = decodeBase64ToArrayBuffer(boldBase64)

  if (!isRenderableOgFontData(regularData) || !isRenderableOgFontData(boldData)) {
    throw new Error(`Cached unsupported font data for ${family}`)
  }

  return [
    {
      name: family,
      data: regularData,
      weight: 400,
      style: 'normal'
    },
    {
      name: family,
      data: boldData,
      weight: 700,
      style: 'normal'
    }
  ]
}

async function readLimitedResponseBytes(response: Response, maxBytes: number): Promise<Buffer | null> {
  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer())
    return bytes.byteLength <= maxBytes ? bytes : null
  }

  const reader = response.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value?.byteLength) continue

    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel().catch(() => undefined)
      return null
    }

    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks)
}

export async function fetchCoverDataUrl(coverUrl: string): Promise<string> {
  const sourceUrl = parsePublicHttpUrl(coverUrl)
  if (!sourceUrl) return ''

  const response = await fetch(sourceUrl, {
    cache: 'no-store',
    redirect: 'follow',
    signal: AbortSignal.timeout(OG_COVER_FETCH_TIMEOUT_MS)
  })
  if (!response.ok) return ''

  const finalUrl = parsePublicHttpUrl(response.url)
  if (!finalUrl) return ''

  const contentType = `${response.headers.get('content-type') || ''}`.split(';')[0].trim().toLowerCase()
  if (!contentType.startsWith('image/')) return ''

  const contentLength = Number(response.headers.get('content-length') || 0)
  if (contentLength > MAX_OG_COVER_BYTES) return ''

  const bytes = await readLimitedResponseBytes(response, MAX_OG_COVER_BYTES)
  if (!bytes) return ''

  return `data:${contentType};base64,${bytes.toString('base64')}`
}
