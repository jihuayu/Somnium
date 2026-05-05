import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeCountryCode, shouldHideCommentsForRequest } from '../lib/server/requestGeo'

test('normalizeCountryCode trims and uppercases values', () => {
  assert.equal(normalizeCountryCode(' cn '), 'CN')
  assert.equal(normalizeCountryCode(''), '')
  assert.equal(normalizeCountryCode(undefined), '')
})

test('shouldHideCommentsForRequest only hides comments for China visitors', () => {
  assert.equal(shouldHideCommentsForRequest(new Headers({
    'x-vercel-ip-country': 'CN'
  })), true)
  assert.equal(shouldHideCommentsForRequest(new Headers({
    'x-vercel-ip-country': 'cn'
  })), true)
  assert.equal(shouldHideCommentsForRequest(new Headers({
    'x-vercel-ip-country': 'US'
  })), false)
  assert.equal(shouldHideCommentsForRequest(new Headers()), false)
})
