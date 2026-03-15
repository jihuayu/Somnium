import test from 'node:test'
import assert from 'node:assert/strict'
import * as entry from '../src/index'
import * as clientEntry from '../src/client'
import dayjs from '../src/dayjs'

test('index exports renderer entry points', () => {
  assert.equal(typeof entry.prepareNotionRenderModel, 'function')
  assert.ok('NotionRenderer' in entry)
  assert.ok('RichText' in entry)
})

test('client entry exports renderer components', () => {
  assert.ok('NotionRenderer' in clientEntry)
  assert.ok('DateMention' in clientEntry)
  assert.ok('UrlMention' in clientEntry)
})

test('dayjs entry keeps timezone plugin available', () => {
  const zoned = dayjs.tz('2026-03-15 12:00:00', 'Asia/Shanghai')
  assert.equal(typeof zoned.format('YYYY-MM-DD'), 'string')
})
