import test from 'node:test'
import assert from 'node:assert/strict'
import { createNotionOutputAdapters, defaultNotionOutputAdapters } from '../src/output-adapters'

test('defaultNotionOutputAdapters exposes og and rss adapters', () => {
  const ogUrl = defaultNotionOutputAdapters.og.imageUrl.adapt({
    baseUrl: 'https://og.example.com/generate',
    title: 'Hello'
  })

  const rss = defaultNotionOutputAdapters.rss.feed.adapt({
    title: 'Feed',
    description: 'Desc',
    siteUrl: 'https://blog.jihuayu.com',
    items: [{
      title: 'Item',
      link: '/item',
      date: '2026-03-13T00:00:00.000Z',
      contentHtml: '<p>hello</p>'
    }]
  })

  assert.equal(ogUrl, 'https://og.example.com/generate/Hello.png')
  assert.match(rss, /<title>Feed<\/title>/)
})

test('createNotionOutputAdapters allows partial module overrides', () => {
  const adapters = createNotionOutputAdapters({
    og: {
      payload: {
        adapt: () => ({
          title: 'custom',
          description: 'custom',
          canonicalUrl: 'https://example.com/custom',
          openGraph: {
            title: 'custom',
            description: 'custom',
            url: 'https://example.com/custom',
            type: 'website',
            images: []
          },
          twitter: {
            card: 'summary_large_image',
            title: 'custom',
            description: 'custom',
            images: []
          }
        })
      }
    }
  })

  const customPayload = adapters.og.payload.adapt({
    title: 'ignored',
    description: 'ignored',
    siteUrl: 'https://blog.jihuayu.com'
  })
  const inheritedUrl = adapters.og.imageUrl.adapt({
    baseUrl: 'https://og.example.com/generate',
    title: 'Hello'
  })

  assert.equal(customPayload.canonicalUrl, 'https://example.com/custom')
  assert.equal(inheritedUrl, 'https://og.example.com/generate/Hello.png')
})