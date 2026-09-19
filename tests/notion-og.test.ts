import assert from 'node:assert/strict'
import test from 'node:test'
import type { ReactElement, ReactNode } from 'react'
import { mapPageToOgData } from '@jihuayu/notion-data'
import { buildNotionOgImageUrl, buildPageMetadata } from '../lib/server/metadata'
import { resolveOgFontFamily, resolvePublishedPageOgData, resolveRenderableGoogleFontUrl } from '../lib/server/notionOg'
import { createBufferedNotionOgImageResponse, createNotionOgImageResponse } from '../app/api/og/notion/route'

const PNG_SIGNATURE_HEX = '89504e470d0a1a0a'
const ONE_PIXEL_PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII='

function treeHasImage(node: ReactNode): boolean {
  if (!node) return false
  if (Array.isArray(node)) return node.some(child => treeHasImage(child))
  if (typeof node !== 'object') return false

  const element = node as ReactElement<{ children?: ReactNode }>
  if (element.type === 'img') return true
  return treeHasImage(element.props?.children)
}

async function assertPngResponse(response: Response): Promise<Buffer> {
  assert.equal(response.headers.get('content-type'), 'image/png')
  const body = Buffer.from(await response.arrayBuffer())
  assert.equal(body.subarray(0, 8).toString('hex'), PNG_SIGNATURE_HEX)
  return body
}

function withOgImageVersion<T>(version: string, run: () => T): T {
  const previousVersion = process.env.NEXT_PUBLIC_OG_IMAGE_VERSION
  process.env.NEXT_PUBLIC_OG_IMAGE_VERSION = version

  try {
    return run()
  } finally {
    if (previousVersion === undefined) {
      delete process.env.NEXT_PUBLIC_OG_IMAGE_VERSION
    } else {
      process.env.NEXT_PUBLIC_OG_IMAGE_VERSION = previousVersion
    }
  }
}

test('mapPageToOgData reads title summary and external cover', () => {
  const data = mapPageToOgData({
    id: 'page-1',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-02T00:00:00.000Z',
    parent: {
      type: 'data_source_id',
      data_source_id: 'source-1'
    },
    cover: {
      type: 'external',
      external: { url: 'https://example.com/cover.jpg' }
    },
    properties: {
      Title: {
        type: 'title',
        title: [{ plain_text: '测试标题' }]
      },
      Summary: {
        type: 'rich_text',
        rich_text: [{ plain_text: '这是摘要' }]
      }
    }
  })

  assert.deepEqual(data, {
    id: 'page-1',
    title: '测试标题',
    summary: '这是摘要',
    coverUrl: 'https://example.com/cover.jpg',
    coverType: 'external'
  })
})

test('mapPageToOgData supports file covers and missing summary', () => {
  const data = mapPageToOgData({
    id: 'page-2',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-02T00:00:00.000Z',
    parent: {
      type: 'data_source_id',
      data_source_id: 'source-1'
    },
    cover: {
      type: 'file',
      file: { url: 'https://notion.so/signed-image' }
    },
    properties: {
      title: {
        type: 'title',
        title: [{ plain_text: 'File Cover' }]
      }
    }
  })

  assert.equal(data.title, 'File Cover')
  assert.equal(data.summary, '')
  assert.equal(data.coverUrl, 'https://notion.so/signed-image')
  assert.equal(data.coverType, 'file')
})

test('buildPageMetadata uses custom ogImageUrl when provided', () => {
  const metadata = buildPageMetadata({
    title: 'Hello',
    description: 'World',
    slug: 'hello',
    ogImageUrl: 'https://example.com/api/og/notion?pageId=abc'
  })

  assert.equal(metadata.openGraph?.images?.[0]?.url, 'https://example.com/api/og/notion?pageId=abc')
  assert.equal(metadata.openGraph?.images?.[0]?.alt, 'Hello')
  assert.equal(metadata.openGraph?.images?.[0]?.width, 1200)
  assert.equal(metadata.openGraph?.images?.[0]?.height, 630)
  assert.equal(metadata.openGraph?.siteName, '浮生纪梦')
  assert.equal(metadata.twitter?.images?.[0]?.url, 'https://example.com/api/og/notion?pageId=abc')
  assert.equal(metadata.twitter?.images?.[0]?.alt, 'Hello')
  assert.equal(metadata.twitter?.images?.[0]?.width, 1200)
  assert.equal(metadata.twitter?.images?.[0]?.height, 630)
})

test('buildNotionOgImageUrl encodes page ids into the local og route', () => {
  const url = withOgImageVersion('test-og-v1', () => buildNotionOgImageUrl('158d8308-8d4e-802e-8d2d-c94b182259ef'))
  const parsed = new URL(url)

  assert.equal(parsed.pathname, '/api/og/notion')
  assert.equal(parsed.searchParams.get('pageId'), '158d8308-8d4e-802e-8d2d-c94b182259ef')
  assert.equal(parsed.searchParams.get('v'), 'test-og-v1')
})

test('buildPageMetadata includes twitter handles and site-level metadata for social scrapers', () => {
  const metadata = withOgImageVersion('test-og-v1', () => buildPageMetadata({
    title: 'Twitter OG',
    description: 'Check handles'
  }))

  assert.equal(metadata.applicationName, '浮生纪梦')
  assert.equal(metadata.creator, '纪华裕')
  assert.equal(metadata.publisher, '浮生纪梦')
  assert.equal(metadata.twitter?.site, '@jihuayu123')
  assert.equal(metadata.twitter?.creator, '@jihuayu123')
  assert.equal((metadata.twitter as { card?: string } | undefined)?.card, 'summary_large_image')
  assert.equal(metadata.twitter?.title, 'Twitter OG')
  assert.equal(metadata.twitter?.description, 'Check handles')
  assert.equal(metadata.openGraph?.siteName, '浮生纪梦')
  assert.deepEqual(metadata.twitter?.images?.[0], {
    url: 'https://og-image-craigary.vercel.app/Twitter%20OG.png?theme=dark&md=1&fontSize=125px&images=https%3A%2F%2Fnobelium.vercel.app%2Flogo-for-dark-bg.svg&v=test-og-v1',
    alt: 'Twitter OG',
    width: 1200,
    height: 630
  })
})

test('resolvePublishedPageOgData falls back to direct page lookup when published lookup fails', async () => {
  const page = await resolvePublishedPageOgData('page-1', {
    getPublishedPageOgData: async () => {
      throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
    },
    getPageOgData: async (pageId) => ({
      id: pageId,
      title: 'Fallback',
      summary: '',
      coverUrl: '',
      coverType: null
    })
  })

  assert.deepEqual(page, {
    id: 'page-1',
    title: 'Fallback',
    summary: '',
    coverUrl: '',
    coverType: null
  })
})

test('resolveRenderableGoogleFontUrl ignores woff2 fonts for OG rendering', () => {
  assert.equal(
    resolveRenderableGoogleFontUrl(`
      @font-face {
        src: url(https://fonts.gstatic.com/font.woff2) format('woff2');
      }
      @font-face {
        src: url("https://fonts.gstatic.com/font.ttf") format("truetype");
      }
    `),
    'https://fonts.gstatic.com/font.ttf'
  )
  assert.equal(
    resolveRenderableGoogleFontUrl(`
      @font-face {
        src: url(https://fonts.gstatic.com/font.woff2) format('woff2');
      }
    `),
    null
  )
})

test('createNotionOgImageResponse falls back to title image when cover rendering fails', () => {
  const attempts: Array<{ hasImage: boolean }> = []

  const response = createNotionOgImageResponse({
    title: 'Fallback Title',
    coverDataUrl: 'data:image/png;base64,abc',
    fontFamily: 'sans-serif',
    fonts: [],
    createResponse: (element, init) => {
      const hasImage = treeHasImage(element)
      attempts.push({ hasImage })

      if (hasImage) {
        throw new Error('cover render failed')
      }

      return { element, init, kind: 'title' } as never
    }
  }) as unknown as { kind: string }

  assert.equal(response.kind, 'title')
  assert.deepEqual(attempts, [
    { hasImage: true },
    { hasImage: false }
  ])
})

test('createBufferedNotionOgImageResponse returns cover-only image when cover rendering succeeds', async () => {
  const attempts: Array<{ hasImage: boolean }> = []

  const response = await createBufferedNotionOgImageResponse({
    title: 'Fallback Title',
    coverDataUrl: 'data:image/png;base64,abc',
    fontFamily: 'sans-serif',
    fonts: [],
    createResponse: (element) => {
      const hasImage = treeHasImage(element)
      attempts.push({ hasImage })

      return new Response('cover image', {
        headers: { 'x-og-kind': hasImage ? 'cover' : 'title' }
      }) as never
    }
  })

  assert.equal(response.headers.get('x-og-kind'), 'cover')
  assert.equal(await response.text(), 'cover image')
  assert.deepEqual(attempts, [{ hasImage: true }])
})

test('createBufferedNotionOgImageResponse falls back when cover stream fails', async () => {
  const attempts: Array<{ hasImage: boolean }> = []

  const response = await createBufferedNotionOgImageResponse({
    title: 'Fallback Title',
    coverDataUrl: 'data:image/png;base64,abc',
    fontFamily: 'sans-serif',
    fonts: [],
    createResponse: (element) => {
      const hasImage = treeHasImage(element)
      attempts.push({ hasImage })

      if (hasImage) {
        return {
          arrayBuffer: async () => {
            throw new Error('cover stream failed')
          },
          headers: new Headers({ 'x-og-kind': 'cover' }),
          status: 200,
          statusText: ''
        } as never
      }

      return new Response('title image', {
        headers: { 'x-og-kind': 'title' }
      }) as never
    }
  })

  assert.equal(response.headers.get('x-og-kind'), 'title')
  assert.equal(await response.text(), 'title image')
  assert.deepEqual(attempts, [
    { hasImage: true },
    { hasImage: false }
  ])
})

test('createBufferedNotionOgImageResponse returns png when all image rendering fails', async () => {
  const response = await createBufferedNotionOgImageResponse({
    title: 'Final Fallback',
    coverDataUrl: '',
    fontFamily: 'sans-serif',
    fonts: [],
    createResponse: () => ({
      arrayBuffer: async () => {
        throw new Error('title stream failed')
      },
      headers: new Headers(),
      status: 200,
      statusText: ''
    }) as never
  })

  await assertPngResponse(response)
})

test('createBufferedNotionOgImageResponse png fallback handles long titles', async () => {
  const response = await createBufferedNotionOgImageResponse({
    title: '关于我因为太想参加读书活动被“骗入”玄学工坊的那些事儿……',
    coverDataUrl: '',
    fontFamily: 'sans-serif',
    fonts: [],
    createResponse: () => ({
      arrayBuffer: async () => {
        throw new Error('title stream failed')
      },
      headers: new Headers(),
      status: 200,
      statusText: ''
    }) as never
  })

  await assertPngResponse(response)
})

test('createBufferedNotionOgImageResponse png fallback keeps cover imagery when available', async () => {
  const response = await createBufferedNotionOgImageResponse({
    title: 'Fallback With Cover',
    coverDataUrl: ONE_PIXEL_PNG_DATA_URL,
    fontFamily: 'sans-serif',
    fonts: [],
    createResponse: () => ({
      arrayBuffer: async () => {
        throw new Error('title stream failed')
      },
      headers: new Headers(),
      status: 200,
      statusText: ''
    }) as never
  })

  await assertPngResponse(response)
})

test('resolveOgFontFamily uses a serif family for Chinese titles', () => {
  assert.equal(resolveOgFontFamily(), 'Noto Serif SC')
})
