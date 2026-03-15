import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFallbackLinkPreview,
  getAnnotationColorClasses,
  getBlockClassName,
  getCalloutIconUrl,
  getHeadingAnchorId,
  renderFallbackHighlightedCodeHtml
} from '../src/utils/notion'

test('block and heading helper build stable class/id values', () => {
  assert.equal(getBlockClassName('1234-5678'), 'notion-block-12345678')
  assert.equal(getHeadingAnchorId('ab-cd'), 'notion-heading-abcd')
})

test('getCalloutIconUrl resolves external and file icon urls', () => {
  assert.equal(getCalloutIconUrl({ type: 'external', external: { url: 'https://img.test/icon.png' } }), 'https://img.test/icon.png')
  assert.equal(getCalloutIconUrl({ type: 'file', file: { url: 'https://file.test/icon.png' } }), 'https://file.test/icon.png')
  assert.equal(getCalloutIconUrl({ type: 'emoji', emoji: '✅' }), '')
  assert.equal(getCalloutIconUrl(null), '')
})

test('renderFallbackHighlightedCodeHtml escapes html source', () => {
  const html = renderFallbackHighlightedCodeHtml('const n = 1 < 2 && 3 > 1')
  assert.match(html, /&lt;/)
  assert.match(html, /&gt;/)
  assert.match(html, /shiki/)
})

test('getAnnotationColorClasses maps normalized text and background colors', () => {
  assert.deepEqual(getAnnotationColorClasses({ color: 'blue' }), {
    textColorClassName: 'notion-color-blue',
    backgroundColorClassName: ''
  })

  assert.deepEqual(getAnnotationColorClasses({ background_color: 'red' }), {
    textColorClassName: '',
    backgroundColorClassName: 'notion-color-red-bg'
  })

  assert.deepEqual(getAnnotationColorClasses({ color: 'default' }), {
    textColorClassName: '',
    backgroundColorClassName: ''
  })
})

test('buildFallbackLinkPreview handles valid and invalid urls', () => {
  const valid = buildFallbackLinkPreview('https://example.com/path')
  assert.equal(valid.hostname, 'example.com')
  assert.match(valid.icon || '', /google\.com\/s2\/favicons/)

  const invalid = buildFallbackLinkPreview('not-a-url')
  assert.equal(invalid.url, 'not-a-url')
  assert.equal(invalid.title, 'not-a-url')
})
