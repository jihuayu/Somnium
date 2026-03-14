import cjk from '@/lib/cjk'
import { getAllPosts } from '@/lib/notion/getAllPosts'
import { mapPageToOgData, type PageOgData } from '@/lib/notion/pageOgData'
import { normalizeNotionUuid } from '@/lib/notion/postMapper'
import { unstable_cache } from 'next/cache'
import { parsePublicHttpUrl } from './url'
import { config } from './config'
import api from './notion-api'

const NOTION_OG_PAGE_CACHE_REVALIDATE_SECONDS = 300
const FONT_CACHE_REVALIDATE_SECONDS = 60 * 60 * 24 * 30
const MAX_OG_COVER_BYTES = 8 * 1024 * 1024
const OG_COVER_FETCH_TIMEOUT_MS = 5000
const GOOGLE_FONTS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

interface OgFontDescriptor {
  name: string
  data: ArrayBuffer
  weight: 400 | 700
  style: 'normal'
}

const getCachedOgPage = unstable_cache(
  async (pageId: string) => {
    const page = await api.retrievePage(pageId)
    return mapPageToOgData(page)
  },
  ['notion-og-page'],
  { revalidate: NOTION_OG_PAGE_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts', 'notion-og-page'] }
)

const getCachedPublishedOgPageIds = unstable_cache(
  async () => {
    const posts = await getAllPosts({ includePages: true })
    return posts
      .map(post => normalizeNotionUuid(post.id))
      .filter(Boolean)
  },
  ['notion-og-page-allowlist'],
  { revalidate: NOTION_OG_PAGE_CACHE_REVALIDATE_SECONDS, tags: ['notion-posts', 'notion-og-page'] }
)

function resolveOgFontFamily(): string {
  const cjkVariant = cjk(config)
  switch (cjkVariant) {
    case 'SC':
      return 'Noto Sans SC'
    case 'TC':
      return 'Noto Sans TC'
    case 'JP':
      return 'Noto Sans JP'
    case 'KR':
      return 'Noto Sans KR'
    default:
      return 'IBM Plex Sans'
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
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\('(opentype|truetype|woff2|woff)'\)/i)
    const fontUrl = match?.[1]
    if (!fontUrl) {
      throw new Error(`Failed to resolve font URL for ${family} (${weight})`)
    }

    const fontResponse = await fetch(fontUrl)
    if (!fontResponse.ok) {
      throw new Error(`Failed to fetch font data for ${family} (${weight})`)
    }

    return Buffer.from(await fontResponse.arrayBuffer()).toString('base64')
  },
  ['notion-og-font'],
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

export async function loadOgFonts(parts: string[]): Promise<OgFontDescriptor[]> {
  const family = resolveOgFontFamily()
  const text = buildFontSubsetText(parts)
  if (!text) return []

  const [regularBase64, boldBase64] = await Promise.all([
    getCachedFontBase64(family, text, 400),
    getCachedFontBase64(family, text, 700)
  ])

  return [
    {
      name: family,
      data: decodeBase64ToArrayBuffer(regularBase64),
      weight: 400,
      style: 'normal'
    },
    {
      name: family,
      data: decodeBase64ToArrayBuffer(boldBase64),
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
