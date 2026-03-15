import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPageHrefMap,
  extractNotionPageIdFromUrl,
  rewriteNotionPageHref
} from '../src'

test('buildPageHrefMap builds internal hrefs from generic entries', () => {
  const pageHrefMap = buildPageHrefMap([
    { id: '12345678-1234-1234-1234-1234567890ab', slug: 'hello-world' },
    { id: 'abcdefab-cdef-cdef-cdef-abcdefabcdef', slug: 'about' }
  ], 'blog')

  assert.deepEqual(pageHrefMap, {
    '123456781234123412341234567890ab': '/blog/hello-world',
    abcdefabcdefcdefcdefabcdefabcdef: '/blog/about'
  })
})

test('extractNotionPageIdFromUrl parses notion page URLs', () => {
  assert.equal(
    extractNotionPageIdFromUrl('https://www.notion.so/workspace/Hello-123456781234123412341234567890ab?pvs=4'),
    '123456781234123412341234567890ab'
  )
  assert.equal(
    extractNotionPageIdFromUrl('https://www.notion.so/12345678-1234-1234-1234-1234567890ab'),
    '123456781234123412341234567890ab'
  )
  assert.equal(extractNotionPageIdFromUrl('https://example.com/notion'), '')
})

test('rewriteNotionPageHref rewrites managed notion page links to internal hrefs', () => {
  const href = rewriteNotionPageHref(
    'https://www.notion.so/workspace/Internal-123456781234123412341234567890ab',
    { '123456781234123412341234567890ab': '/posts/internal' }
  )

  assert.equal(href, '/posts/internal')
  assert.equal(rewriteNotionPageHref('https://example.com', {}), 'https://example.com')
})