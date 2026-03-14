import assert from 'node:assert/strict'
import test from 'node:test'
import { fetchCoverDataUrl } from '../lib/server/notionOg'
import { isPrivateHostname, parsePublicHttpUrl } from '../lib/server/url'

test('parsePublicHttpUrl only accepts public http urls', () => {
  assert.equal(parsePublicHttpUrl('https://example.com/cover.png')?.toString(), 'https://example.com/cover.png')
  assert.equal(parsePublicHttpUrl('http://127.0.0.1/internal.png'), null)
  assert.equal(parsePublicHttpUrl('http://[::1]/internal.png'), null)
  assert.equal(parsePublicHttpUrl('file:///tmp/cover.png'), null)
})

test('isPrivateHostname detects local-only targets', () => {
  assert.equal(isPrivateHostname('localhost'), true)
  assert.equal(isPrivateHostname('cache.local'), true)
  assert.equal(isPrivateHostname('192.168.0.10'), true)
  assert.equal(isPrivateHostname('example.com'), false)
})

test('fetchCoverDataUrl rejects private source urls before fetch', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalled = false

  globalThis.fetch = (async () => {
    fetchCalled = true
    throw new Error('fetch should not run for blocked urls')
  }) as typeof fetch

  try {
    const result = await fetchCoverDataUrl('http://127.0.0.1/cover.png')
    assert.equal(result, '')
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchCoverDataUrl rejects redirects that end on private hosts', async () => {
  const originalFetch = globalThis.fetch

  globalThis.fetch = (async () => ({
    ok: true,
    url: 'http://127.0.0.1/final.png',
    headers: new Headers({
      'content-type': 'image/png',
      'content-length': '4'
    }),
    body: null,
    arrayBuffer: async () => Uint8Array.from([1, 2, 3, 4]).buffer
  })) as typeof fetch

  try {
    const result = await fetchCoverDataUrl('https://example.com/cover.png')
    assert.equal(result, '')
  } finally {
    globalThis.fetch = originalFetch
  }
})
