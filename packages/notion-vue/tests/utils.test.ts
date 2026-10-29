import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFallbackLinkPreview,
  getAnnotationColorClasses,
  getBlockClassName,
  getCalloutIconUrl,
  getHeadingAnchorId,
  renderFallbackHighlightedCodeHtml,
  toOgProxyImageUrl,
  toOgProxyPreviewImageUrl
} from '../src/utils/notion'

test('block and heading helper build stable class/id values', () => {
  assert.equal(getBlockClassName('1234-5678'), 'notion-block-12345678')
  assert.equal(getHeadingAnchorId('ab-cd'), 'notion-heading-abcd')
})

test('getCalloutIconUrl resolves external and file icon urls', () => {
  assert.equal(getCalloutIconUrl({ type: 'external', external: { url: 'https://img.test/icon.png' } }), 'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fimg.test%2Ficon.png')
  assert.equal(getCalloutIconUrl({ type: 'file', file: { url: 'https://file.test/icon.png' } }), 'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Ffile.test%2Ficon.png')
  assert.equal(getCalloutIconUrl({ type: 'emoji', emoji: '✅' }), '')
  assert.equal(getCalloutIconUrl(null), '')
})

test('toOgProxyImageUrl routes external images through og proxy', () => {
  assert.equal(
    toOgProxyImageUrl('https://example.com/image.png', 'https://example.com/page'),
    'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fexample.com%2Fimage.png&referer=https%3A%2F%2Fexample.com%2Fpage'
  )
  assert.equal(
    toOgProxyImageUrl('https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fgithub.com%2Ffluidicon.png&q=80&f=jpeg&fit=scale-down'),
    'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fgithub.com%2Ffluidicon.png'
  )
  assert.equal(toOgProxyImageUrl('/local.png'), '/local.png')
})

test('toOgProxyPreviewImageUrl keeps preview images as png through og proxy', () => {
  assert.equal(
    toOgProxyPreviewImageUrl('https://opengraph.githubassets.com/hash/repo', 'https://github.com/jihuayu/Somnium'),
    'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fopengraph.githubassets.com%2Fhash%2Frepo&referer=https%3A%2F%2Fgithub.com%2Fjihuayu%2FSomnium&f=png'
  )
  assert.equal(
    toOgProxyPreviewImageUrl('https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fopengraph.githubassets.com%2Fhash%2Frepo&q=80&f=jpeg&fit=scale-down'),
    'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fopengraph.githubassets.com%2Fhash%2Frepo&f=png'
  )
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
  assert.equal(
    valid.icon,
    'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fwww.google.com%2Fs2%2Ffavicons%3Fdomain%3Dexample.com%26sz%3D32&referer=https%3A%2F%2Fexample.com%2Fpath'
  )

  const invalid = buildFallbackLinkPreview('not-a-url')
  assert.equal(invalid.url, 'not-a-url')
  assert.equal(invalid.title, 'not-a-url')
})
