import assert from 'node:assert/strict'
import test from 'node:test'
import { safeCompareStrings } from '../lib/server/safeCompare'

test('safeCompareStrings only matches identical non-empty strings', () => {
  assert.equal(safeCompareStrings('secret', 'secret'), true)
  assert.equal(safeCompareStrings('secret', 'secret-2'), false)
  assert.equal(safeCompareStrings('secret', ''), false)
  assert.equal(safeCompareStrings('', ''), false)
})