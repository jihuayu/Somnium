import test from 'node:test'
import assert from 'node:assert/strict'
import { getFloatingHoverCardComputeOptions } from '../src/components/floatingHoverCardPosition'

test('Vue hover cards default to centered top placement and flip when they do not fit', () => {
  const options = getFloatingHoverCardComputeOptions(10, 12)
  assert.equal(options.placement, 'top')
  assert.equal(options.strategy, 'fixed')
  assert.deepEqual(options.middleware.map(middleware => middleware.name), ['inline', 'offset', 'flip', 'shift'])
})
