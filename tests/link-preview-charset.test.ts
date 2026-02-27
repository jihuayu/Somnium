import assert from 'node:assert/strict'
import test from 'node:test'
import { parseCharsetFromContentType } from '../lib/server/linkPreview'

test('parseCharsetFromContentType normalizes common aliases', () => {
  assert.equal(parseCharsetFromContentType('text/html; charset=UTF-8'), 'utf-8')
  assert.equal(parseCharsetFromContentType('text/html; charset=utf8'), 'utf-8')
  assert.equal(parseCharsetFromContentType('text/html; charset=gb2312'), 'gbk')
  assert.equal(parseCharsetFromContentType('text/html; charset=gb18030'), 'gb18030')
  assert.equal(parseCharsetFromContentType('text/html'), '')
})
