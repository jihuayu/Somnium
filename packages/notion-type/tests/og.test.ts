import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOgImageUrl, buildOpenGraphPayload, ogAdapter } from '../src/og'

test('buildOgImageUrl appends encoded title and query params', () => {
  const url = buildOgImageUrl({
    baseUrl: 'https://og.example.com/generate',
    title: 'Hello World',
    query: {
      theme: 'dark',
      md: 1
    }
  })

  assert.equal(url, 'https://og.example.com/generate/Hello%20World.png?theme=dark&md=1')
})

test('buildOpenGraphPayload returns canonical, og and twitter payloads', () => {
  const payload = buildOpenGraphPayload({
    title: 'Post',
    description: 'Description',
    siteUrl: 'https://blog.jihuayu.com',
    slug: '/posts/post',
    type: 'article',
    locale: 'zh-CN',
    images: ['https://cdn.example.com/og.png'],
    authors: ['jihuayu'],
    publishedTime: '2026-03-13T00:00:00.000Z'
  })

  assert.equal(payload.canonicalUrl, 'https://blog.jihuayu.com/posts/post')
  assert.equal(payload.openGraph.type, 'article')
  assert.deepEqual(payload.twitter.images, ['https://cdn.example.com/og.png'])
  assert.equal(payload.openGraph.publishedTime, '2026-03-13T00:00:00.000Z')
})

test('ogAdapter exposes the default adapter contract', () => {
  const url = ogAdapter.imageUrl.adapt({
    baseUrl: 'https://og.example.com/generate',
    title: 'Adapter Demo'
  })
  const payload = ogAdapter.payload.adapt({
    title: 'Adapter Demo',
    description: 'Adapter Description',
    siteUrl: 'https://blog.jihuayu.com'
  })

  assert.equal(url, 'https://og.example.com/generate/Adapter%20Demo.png')
  assert.equal(payload.canonicalUrl, 'https://blog.jihuayu.com')
})