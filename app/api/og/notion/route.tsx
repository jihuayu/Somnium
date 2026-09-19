import { ImageResponse } from '@vercel/og'
import type { ReactElement } from 'react'
import { config } from '@/lib/server/config'
import { fetchCoverDataUrl, loadOgFonts, resolvePublishedPageOgData } from '@/lib/server/notionOg'

export const runtime = 'nodejs'

const IMAGE_WIDTH = 1200
const IMAGE_HEIGHT = 630
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400'
const MINIMAL_PNG_FALLBACK = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='
const SVG_SYSTEM_FONT_STACK = [
  'Noto Serif SC',
  'Noto Serif TC',
  'Noto Serif JP',
  'Source Serif 4',
  'Source Serif',
  'Georgia',
  'Songti SC',
  'serif'
].join(', ')

function normalizeText(value: string, limit: number): string {
  const trimmed = `${value || ''}`.trim()
  if (!trimmed) return ''
  if (trimmed.length <= limit) return trimmed
  return `${trimmed.slice(0, Math.max(limit - 1, 1)).trimEnd()}...`
}

function estimateTextUnits(char: string): number {
  if (!char) return 0
  if (/\s/u.test(char)) return 0.35

  const codePoint = char.codePointAt(0) ?? 0
  if (codePoint <= 0x7f) {
    return /[A-Za-z0-9]/.test(char) ? 0.62 : 0.45
  }

  return 1
}

function appendEllipsis(value: string): string {
  const trimmed = value.trimEnd()
  if (!trimmed) return '...'
  return /(?:\.\.\.|…+)$/.test(trimmed) ? trimmed : `${trimmed}...`
}

function isPunctuationOnlyLine(value: string): boolean {
  return /^[\s.…,，。!?！？:：;；'"“”‘’、-]+$/u.test(value)
}

function wrapTextLines(value: string, maxUnitsPerLine: number, maxLines: number): string[] {
  const source = `${value || ''}`.trim()
  if (!source) return []

  const chars = Array.from(source)
  const lines: string[] = []
  let current = ''
  let units = 0
  let index = 0
  let truncated = false

  while (index < chars.length) {
    const char = chars[index]
    const charUnits = estimateTextUnits(char)

    if (units + charUnits > maxUnitsPerLine && current.trim()) {
      lines.push(current.trimEnd())
      if (lines.length === maxLines) {
        truncated = true
        break
      }

      current = /\s/u.test(char) ? '' : char
      units = /\s/u.test(char) ? 0 : charUnits
      index += 1
      continue
    }

    current += char
    units += charUnits
    index += 1
  }

  if (!truncated && current.trim() && lines.length < maxLines) {
    lines.push(current.trimEnd())
  }

  if (!truncated && lines.length > 1) {
    const lastLine = lines[lines.length - 1] || ''
    const priorLine = lines[lines.length - 2] || ''
    const lastLineUnits = Array.from(lastLine).reduce((total, char) => total + estimateTextUnits(char), 0)
    const priorLineUnits = Array.from(priorLine).reduce((total, char) => total + estimateTextUnits(char), 0)

    if (isPunctuationOnlyLine(lastLine) || (lastLineUnits <= 2 && (priorLineUnits + lastLineUnits) <= maxUnitsPerLine)) {
      lines.splice(lines.length - 2, 2, `${priorLine}${lastLine}`.trim())
    }
  }

  if (truncated && lines.length) {
    lines[lines.length - 1] = appendEllipsis(lines[lines.length - 1])
  }

  return lines
}

function renderWrappedTextLines(lines: string[]) {
  return lines.map((line, index) => (
    <div key={`${index}-${line}`} style={{ display: 'flex' }}>
      {line}
    </div>
  ))
}

function buildBaseContainer(background: string, color: string, fontFamily: string) {
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    position: 'relative' as const,
    overflow: 'hidden' as const,
    background,
    color,
    fontFamily
  }
}

function renderCoverOnlyOgImage({
  coverDataUrl,
  fontFamily
}: {
  coverDataUrl: string
  fontFamily: string
}) {
  return (
    <div style={buildBaseContainer('#1c1917', '#ffffff', fontFamily)}>
      <img
        src={coverDataUrl}
        alt=""
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />
    </div>
  )
}

function renderTitleOgImage({
  title,
  fontFamily
}: {
  title: string
  fontFamily: string
}) {
  const titleLines = wrapTextLines(title, 14, 3)

  return (
    <div style={buildBaseContainer(config.lightBackground || '#ffffff', '#1c1917', fontFamily)}>
      <div
        style={{
          position: 'absolute',
          top: -160,
          right: -120,
          width: 420,
          height: 420,
          borderRadius: '999px',
          background: 'rgba(24, 24, 27, 0.05)'
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -180,
          left: -80,
          width: 360,
          height: 360,
          borderRadius: '999px',
          background: 'rgba(24, 24, 27, 0.08)'
        }}
      />
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          padding: '72px'
        }}
      >
        <div
          style={{
            display: 'flex',
            width: 148,
            height: 12,
            borderRadius: 999,
            background: '#1c1917'
          }}
        />
        <div
          style={{
            display: 'flex',
            maxWidth: '980px',
            fontSize: 72,
            lineHeight: 1.15,
            fontWeight: 600,
            letterSpacing: '0.02em',
            flexDirection: 'column',
            width: '100%'
          }}
        >
          {renderWrappedTextLines(titleLines)}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            color: 'rgba(28, 25, 23, 0.55)'
          }}
        >
          {config.title}
        </div>
      </div>
    </div>
  )
}

interface OgImageResponseOptions {
  title: string
  coverDataUrl: string
  fontFamily: string
  fonts: Awaited<ReturnType<typeof loadOgFonts>>
  createResponse?: (element: ReactElement, init: ConstructorParameters<typeof ImageResponse>[1]) => ImageResponse
  onCoverRenderError?: (error: unknown) => void
  onTitleRenderError?: (error: unknown) => void
}

function buildImageResponseInit(fontFamily: string, fonts: Awaited<ReturnType<typeof loadOgFonts>>) {
  return {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    fonts: fonts.length
      ? fonts.map(font => ({ ...font, name: fontFamily }))
      : undefined,
    emoji: 'twemoji' as const,
    headers: {
      'cache-control': CACHE_CONTROL
    }
  }
}

export function createNotionOgImageResponse({
  title,
  coverDataUrl,
  fontFamily,
  fonts,
  createResponse = (element, init) => new ImageResponse(element, init),
  onCoverRenderError
}: OgImageResponseOptions) {
  const init = buildImageResponseInit(fontFamily, fonts)

  if (coverDataUrl) {
    try {
      return createResponse(renderCoverOnlyOgImage({ coverDataUrl, fontFamily }), init)
    } catch (error) {
      onCoverRenderError?.(error)
    }
  }

  return createResponse(renderTitleOgImage({ title, fontFamily }), init)
}

async function bufferImageResponse(response: Response): Promise<Response> {
  const body = await response.arrayBuffer()

  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  })
}

function escapeSvgText(value: string): string {
  return value.replace(/[&<>"']/g, char => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&apos;'
    }
  })
}

function buildSvgTextElements({
  lines,
  x,
  startY,
  lineHeight,
  fontSize,
  fontWeight,
  fill
}: {
  lines: string[]
  x: number
  startY: number
  lineHeight: number
  fontSize: number
  fontWeight: number
  fill: string
}): string {
  return lines.map((line, index) => {
    const y = startY + (index * lineHeight)
    return `<text x="${x}" y="${y}" fill="${escapeSvgText(fill)}" font-family="${escapeSvgText(SVG_SYSTEM_FONT_STACK)}" font-size="${fontSize}" font-weight="${fontWeight}">${escapeSvgText(line)}</text>`
  }).join('\n')
}

function createSvgFallbackMarkup({
  title,
  coverDataUrl
}: {
  title: string
  coverDataUrl: string
}): string {
  const safeTitle = normalizeText(title || config.title, 120) || config.title
  const safeSiteTitle = escapeSvgText(config.title)
  const titleLines = wrapTextLines(safeTitle, 14, 3)

  return coverDataUrl
    ? (() => {
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">
<rect width="1200" height="630" fill="#1c1917"/>
<image href="${escapeSvgText(coverDataUrl)}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>
</svg>`
      })()
    : (() => {
        const titleLineHeight = 84
        const titleStartY = 320 - (((titleLines.length - 1) * titleLineHeight) / 2)
        return `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">
<rect width="1200" height="630" fill="${escapeSvgText(config.lightBackground || '#ffffff')}"/>
<circle cx="1060" cy="40" r="210" fill="rgba(24,24,27,0.05)"/>
<circle cx="30" cy="640" r="240" fill="rgba(24,24,27,0.08)"/>
<rect x="72" y="72" width="148" height="12" rx="6" fill="#1c1917"/>
${buildSvgTextElements({
  lines: titleLines,
  x: 72,
  startY: titleStartY,
  lineHeight: titleLineHeight,
  fontSize: 64,
  fontWeight: 600,
  fill: '#1c1917'
})}
<text x="72" y="558" fill="rgba(28,25,23,0.55)" font-family="${escapeSvgText(SVG_SYSTEM_FONT_STACK)}" font-size="22">${safeSiteTitle}</text>
</svg>`
      })()
}

function createPngResponse(body: Buffer | Uint8Array): Response {
  const bytes = body instanceof Buffer ? body : Buffer.from(body)
  const arrayBuffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(arrayBuffer).set(bytes)

  return new Response(arrayBuffer, {
    headers: {
      'content-type': 'image/png',
      'cache-control': CACHE_CONTROL
    }
  })
}

function createRawCoverFallbackImageResponse(coverDataUrl: string): Response | null {
  const match = /^data:(image\/(?:png|jpe?g|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i.exec(coverDataUrl || '')
  if (!match) return null

  const [, contentType, base64] = match
  return new Response(Buffer.from(base64.replace(/\s/g, ''), 'base64'), {
    headers: {
      'content-type': contentType.toLowerCase().replace('image/jpg', 'image/jpeg'),
      'cache-control': CACHE_CONTROL
    }
  })
}

async function createPngFallbackImageResponse({
  title,
  coverDataUrl
}: {
  title: string
  coverDataUrl: string
}): Promise<Response> {
  try {
    const svg = createSvgFallbackMarkup({ title, coverDataUrl })
    const { default: sharp } = await import('sharp')
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    return createPngResponse(png)
  } catch {
    return createRawCoverFallbackImageResponse(coverDataUrl) || createPngResponse(Buffer.from(MINIMAL_PNG_FALLBACK, 'base64'))
  }
}

export async function createBufferedNotionOgImageResponse({
  title,
  coverDataUrl,
  fontFamily,
  fonts,
  createResponse = (element, init) => new ImageResponse(element, init),
  onCoverRenderError,
  onTitleRenderError
}: OgImageResponseOptions): Promise<Response> {
  const init = buildImageResponseInit(fontFamily, fonts)

  if (coverDataUrl) {
    try {
      const response = createResponse(renderCoverOnlyOgImage({ coverDataUrl, fontFamily }), init)
      return await bufferImageResponse(response)
    } catch (error) {
      onCoverRenderError?.(error)
    }
  }

  try {
    return await bufferImageResponse(createResponse(renderTitleOgImage({ title, fontFamily }), init))
  } catch (error) {
    onTitleRenderError?.(error)
    return createPngFallbackImageResponse({ title, coverDataUrl })
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = `${searchParams.get('pageId') || ''}`.trim()

  if (!pageId) {
    return new Response('Missing pageId', { status: 400 })
  }

  let page = null

  page = await resolvePublishedPageOgData(pageId, {
    onPublishedLookupError: (error) => {
      console.error('[og] Published page lookup failed, falling back to direct page lookup', {
        pageId,
        error
      })
    }
  })

  if (!page) {
    return new Response('Not found', {
      status: 404,
      headers: { 'cache-control': 'no-store' }
    })
  }

  const title = normalizeText(page.title || config.title, 120) || config.title
  const summary = normalizeText(page.summary || '', 240)
  let coverDataUrl = ''

  if (page.coverUrl) {
    try {
      coverDataUrl = await fetchCoverDataUrl(page.coverUrl)
    } catch (error) {
      console.error(`[og] Failed to fetch cover for page ${pageId}:`, error)
    }
  }

  let fonts: Awaited<ReturnType<typeof loadOgFonts>> = []
  try {
    fonts = await loadOgFonts([title, summary, config.title])
  } catch (error) {
    console.error(`[og] Failed to load OG fonts for page ${pageId}:`, error)
  }

  const fontFamily = fonts.length ? 'NotionOgSerif' : 'serif'

  return createBufferedNotionOgImageResponse({
    title,
    coverDataUrl,
    fontFamily,
    fonts,
    onCoverRenderError: (error) => {
      console.error('[og] Failed to render cover image, falling back to title image', {
        pageId,
        error
      })
    },
    onTitleRenderError: (error) => {
      console.error('[og] Failed to render title image, falling back to svg image', {
        pageId,
        error
      })
    }
  })
}
