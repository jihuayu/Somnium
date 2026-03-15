import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPageHrefMap,
  extractNotionPageIdFromUrl,
  rewriteNotionPageHref
} from '../../notion-type/src'

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
  const id = extractNotionPageIdFromUrl('https://www.notion.so/workspace/Hello-World-123456781234123412341234567890ab?pvs=4#abcdef')
  assert.equal(id, '123456781234123412341234567890ab')
})

test('rewriteNotionPageHref rewrites managed notion page links to internal hrefs', () => {
  const pageHrefMap = {
    '123456781234123412341234567890ab': '/posts/hello-world'
  }

  assert.equal(
    rewriteNotionPageHref('https://www.notion.so/workspace/Hello-World-123456781234123412341234567890ab?pvs=4', pageHrefMap),
    '/posts/hello-world'
  )
  assert.equal(
    rewriteNotionPageHref('https://example.com/hello', pageHrefMap),
    'https://example.com/hello'
  )
})
