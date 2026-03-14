import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSitemapEntries } from '../lib/server/sitemap'

test('buildSitemapEntries includes site routes and excludes api routes', () => {
  const entries = buildSitemapEntries({
    siteOrigin: 'https://example.com',
    basePath: '',
    postsPerPage: 1,
    allPosts: [
      {
        id: 'post-1',
        title: 'Post 1',
        slug: 'post-1',
        summary: '',
        tags: ['技术'],
        type: ['Post'],
        status: ['Published'],
        fullWidth: false,
        date: new Date('2026-03-10T00:00:00.000Z').valueOf()
      },
      {
        id: 'page-1',
        title: 'About',
        slug: 'about',
        summary: '',
        tags: [],
        type: ['Page'],
        status: ['Published'],
        fullWidth: false,
        date: new Date('2026-03-09T00:00:00.000Z').valueOf()
      }
    ],
    publishedPosts: [
      {
        id: 'post-1',
        title: 'Post 1',
        slug: 'post-1',
        summary: '',
        tags: ['技术'],
        type: ['Post'],
        status: ['Published'],
        fullWidth: false,
        date: new Date('2026-03-10T00:00:00.000Z').valueOf()
      },
      {
        id: 'post-2',
        title: 'Post 2',
        slug: 'post-2',
        summary: '',
        tags: ['技术'],
        type: ['Post'],
        status: ['Published'],
        fullWidth: false,
        date: new Date('2026-03-08T00:00:00.000Z').valueOf()
      }
    ]
  })

  const urls = entries.map(entry => entry.url)

  assert.ok(urls.includes('https://example.com'))
  assert.ok(urls.includes('https://example.com/search'))
  assert.ok(urls.includes('https://example.com/feed'))
  assert.ok(urls.includes('https://example.com/post-1'))
  assert.ok(urls.includes('https://example.com/about'))
  assert.ok(urls.includes('https://example.com/page/2'))
  assert.ok(urls.includes('https://example.com/tag/%E6%8A%80%E6%9C%AF'))
  assert.equal(urls.some(url => url.includes('/api/')), false)
})

test('buildSitemapEntries prefixes configured basePath', () => {
  const entries = buildSitemapEntries({
    siteOrigin: 'https://example.com',
    basePath: '/blog',
    postsPerPage: 10,
    allPosts: [
      {
        id: 'post-1',
        title: 'Post 1',
        slug: 'post-1',
        summary: '',
        tags: [],
        type: ['Post'],
        status: ['Published'],
        fullWidth: false,
        date: new Date('2026-03-10T00:00:00.000Z').valueOf()
      }
    ],
    publishedPosts: [
      {
        id: 'post-1',
        title: 'Post 1',
        slug: 'post-1',
        summary: '',
        tags: [],
        type: ['Post'],
        status: ['Published'],
        fullWidth: false,
        date: new Date('2026-03-10T00:00:00.000Z').valueOf()
      }
    ]
  })

  const urls = entries.map(entry => entry.url)

  assert.ok(urls.includes('https://example.com/blog'))
  assert.ok(urls.includes('https://example.com/blog/search'))
  assert.ok(urls.includes('https://example.com/blog/feed'))
  assert.ok(urls.includes('https://example.com/blog/post-1'))
})
