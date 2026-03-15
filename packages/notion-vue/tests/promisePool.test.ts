import test from 'node:test'
import assert from 'node:assert/strict'
import { mapWithConcurrency } from '../src/utils/promisePool'

test('mapWithConcurrency returns mapped results in original order', async () => {
  const result = await mapWithConcurrency([1, 2, 3], 2, async (item) => item * 2)
  assert.deepEqual(result, [2, 4, 6])
})

test('mapWithConcurrency handles empty input and invalid concurrency values', async () => {
  const empty = await mapWithConcurrency<number, number>([], 0, async (item) => item)
  assert.deepEqual(empty, [])

  const result = await mapWithConcurrency([1, 2], 0, async (item) => item + 1)
  assert.deepEqual(result, [2, 3])
})

test('mapWithConcurrency limits parallel workers', async () => {
  let running = 0
  let peak = 0

  await mapWithConcurrency([1, 2, 3, 4], 2, async (item) => {
    running += 1
    peak = Math.max(peak, running)
    await new Promise(resolve => setTimeout(resolve, 5))
    running -= 1
    return item
  })

  assert.ok(peak <= 2)
})
