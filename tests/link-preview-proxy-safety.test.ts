import assert from 'node:assert/strict'
import test from 'node:test'
import {
  canUseLinkPreviewOgProxy,
  resolveLinkPreviewImageProxy
} from '../lib/server/linkPreviewImageProxy'
import {
  buildSafeImageProxyResponseHeaders,
  isSafeProxyRedirectTarget
} from '../lib/server/linkPreviewProxySafety'

test('resolveLinkPreviewImageProxy only allows whitelisted douban hosts', () => {
  const allowed = resolveLinkPreviewImageProxy('https://img3.doubanio.com/view/subject/l/public/s35172637.jpg')
  const blocked = resolveLinkPreviewImageProxy('https://opengraph.githubassets.com/hash/repo')

  assert.ok(allowed)
  assert.equal(allowed?.rule.id, 'douban')
  assert.equal(blocked, null)
})

test('canUseLinkPreviewOgProxy validates nested /api/link-preview/image url', () => {
  const allowedNested = '/api/link-preview/image?url=https%3A%2F%2Fimg2.doubanio.com%2Fview%2Fsubject%2Fl%2Fpublic%2Fs.jpg'
  const blockedNested = '/api/link-preview/image?url=https%3A%2F%2Fopengraph.githubassets.com%2Fhash'
  const blockedPath = '/api/other?url=https%3A%2F%2Fimg2.doubanio.com%2Fimage.jpg'

  assert.equal(canUseLinkPreviewOgProxy(allowedNested), true)
  assert.equal(canUseLinkPreviewOgProxy(blockedNested), false)
  assert.equal(canUseLinkPreviewOgProxy(blockedPath), false)
})

test('buildSafeImageProxyResponseHeaders strips unsafe upstream headers', () => {
  const upstream = new Headers({
    'content-type': 'image/jpeg',
    etag: '"abc"',
    'last-modified': 'Sat, 01 Jan 2000 00:00:00 GMT',
    vary: 'Accept',
    'set-cookie': 'sid=1',
    'x-custom': 'danger'
  })
  const headers = buildSafeImageProxyResponseHeaders(upstream, 'public, max-age=3600')

  assert.equal(headers.get('content-type'), 'image/jpeg')
  assert.equal(headers.get('etag'), '"abc"')
  assert.equal(headers.get('last-modified'), 'Sat, 01 Jan 2000 00:00:00 GMT')
  assert.equal(headers.get('vary'), 'Accept')
  assert.equal(headers.get('cache-control'), 'public, max-age=3600')
  assert.equal(headers.get('x-content-type-options'), 'nosniff')
  assert.equal(headers.get('set-cookie'), null)
  assert.equal(headers.get('x-custom'), null)
})

test('isSafeProxyRedirectTarget blocks private or non-whitelisted redirects', () => {
  assert.equal(isSafeProxyRedirectTarget('http://127.0.0.1/private.jpg'), false)
  assert.equal(isSafeProxyRedirectTarget('https://opengraph.githubassets.com/hash/repo'), false)
  assert.equal(
    isSafeProxyRedirectTarget('https://img1.doubanio.com/view/subject/l/public/s35172637.jpg'),
    true
  )
})
