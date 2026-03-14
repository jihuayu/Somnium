import assert from 'node:assert/strict'
import test from 'node:test'
import { mapPageToOgData } from '../lib/notion/pageOgData'
import { buildNotionOgImageUrl, buildPageMetadata } from '../lib/server/metadata'

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
  assert.equal(metadata.openGraph?.siteName, '浮生纪梦')
  assert.equal(metadata.twitter?.images?.[0], 'https://example.com/api/og/notion?pageId=abc')
})

test('buildNotionOgImageUrl encodes page ids into the local og route', () => {
  const url = buildNotionOgImageUrl('158d8308-8d4e-802e-8d2d-c94b182259ef')
  const parsed = new URL(url)

  assert.equal(parsed.pathname, '/api/og/notion')
  assert.equal(parsed.searchParams.get('pageId'), '158d8308-8d4e-802e-8d2d-c94b182259ef')
})

test('buildPageMetadata includes twitter handles and site-level metadata for social scrapers', () => {
  const metadata = buildPageMetadata({
    title: 'Twitter OG',
    description: 'Check handles'
  })

  assert.equal(metadata.applicationName, '浮生纪梦')
  assert.equal(metadata.creator, '纪华裕')
  assert.equal(metadata.publisher, '浮生纪梦')
  assert.equal(metadata.twitter?.site, '@jihuayu123')
  assert.equal(metadata.twitter?.creator, '@jihuayu123')
  assert.equal(metadata.openGraph?.siteName, '浮生纪梦')
  assert.equal(
    metadata.twitter?.images?.[0],
    'https://og-image-craigary.vercel.app/Twitter%20OG.png?theme=dark&md=1&fontSize=125px&images=https%3A%2F%2Fnobelium.vercel.app%2Flogo-for-dark-bg.svg'
  )
})
