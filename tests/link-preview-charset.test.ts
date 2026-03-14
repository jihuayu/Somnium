import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildOgProxyApiUrl,
  mapOgProxyPayloadToPreview,
  parseCharsetFromContentType
} from '../lib/server/linkPreviewShared'

test('parseCharsetFromContentType normalizes common aliases', () => {
  assert.equal(parseCharsetFromContentType('text/html; charset=UTF-8'), 'utf-8')
  assert.equal(parseCharsetFromContentType('text/html; charset=utf8'), 'utf-8')
  assert.equal(parseCharsetFromContentType('text/html; charset=gb2312'), 'gbk')
  assert.equal(parseCharsetFromContentType('text/html; charset=gb18030'), 'gb18030')
  assert.equal(parseCharsetFromContentType('text/html'), '')
})

test('buildOgProxyApiUrl appends api path and preserves encoded target url', () => {
  assert.equal(
    buildOgProxyApiUrl('https://og-proxy.raw2.cc', 'https://blog.jihuayu.com/posts/hello?draft=0'),
    'https://og-proxy.raw2.cc/api?url=https%3A%2F%2Fblog.jihuayu.com%2Fposts%2Fhello%3Fdraft%3D0'
  )
})

test('mapOgProxyPayloadToPreview prefers proxy media fields from og proxy payload', () => {
  const preview = mapOgProxyPayloadToPreview(
    'https://blog.jihuayu.com/',
    {
      url: 'https://blog.jihuayu.com/',
      hostname: 'blog.jihuayu.com',
      title: 'blog.jihuayu.com',
      description: '',
      image: '',
      icon: 'https://www.google.com/s2/favicons?domain=blog.jihuayu.com&sz=32'
    },
    {
      status: 'success',
      data: {
        title: '浮生纪梦',
        description: '大梦一场，浮生今歇',
        url: 'https://jihuayu.com/',
        image: {
          url: 'https://example.com/og.png?foo=1&amp;bar=2',
          proxy: 'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fexample.com%2Fog.png'
        },
        logo: {
          url: 'https://example.com/favicon.png',
          proxy: 'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fexample.com%2Ffavicon.png'
        }
      }
    }
  )

  assert.deepEqual(preview, {
    url: 'https://jihuayu.com/',
    hostname: 'jihuayu.com',
    title: '浮生纪梦',
    description: '大梦一场，浮生今歇',
    image: 'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fexample.com%2Fog.png',
    icon: 'https://og-proxy.raw2.cc/proxy/image?url=https%3A%2F%2Fexample.com%2Ffavicon.png'
  })
})
