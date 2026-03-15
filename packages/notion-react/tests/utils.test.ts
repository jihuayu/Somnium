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

test('react utils build stable identifiers', () => {
  assert.equal(getBlockClassName('1234-5678'), 'notion-block-12345678')
  assert.equal(getHeadingAnchorId('ab-cd'), 'notion-heading-abcd')
})

test('react utils resolve callout icon url', () => {
  assert.equal(getCalloutIconUrl({ type: 'external', external: { url: 'https://img.test/icon.png' } }), 'https://img.test/icon.png')
  assert.equal(getCalloutIconUrl({ type: 'file', file: { url: 'https://file.test/icon.png' } }), 'https://file.test/icon.png')
  assert.equal(getCalloutIconUrl({ type: 'emoji', emoji: 'ok' }), '')
})

test('react utils renderFallbackHighlightedCodeHtml escapes text', () => {
  const html = renderFallbackHighlightedCodeHtml('if (a < b && c > d) return')
  assert.match(html, /&lt;/)
  assert.match(html, /&gt;/)
  assert.match(html, /shiki/)
})

test('react utils map annotation colors', () => {
  assert.deepEqual(getAnnotationColorClasses({ color: 'blue' }), {
    textColorClassName: 'notion-color-blue',
    backgroundColorClassName: ''
  })

  assert.deepEqual(getAnnotationColorClasses({ background_color: 'red' }), {
    textColorClassName: '',
    backgroundColorClassName: 'notion-color-red-bg'
  })

  assert.deepEqual(getAnnotationColorClasses(undefined), {
    textColorClassName: '',
    backgroundColorClassName: ''
  })
})

test('react utils build fallback preview', () => {
  const valid = buildFallbackLinkPreview('https://example.com/path')
  assert.equal(valid.hostname, 'example.com')

  const invalid = buildFallbackLinkPreview('invalid-url')
  assert.equal(invalid.title, 'invalid-url')
})
