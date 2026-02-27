import assert from 'node:assert/strict'
import test from 'node:test'
import { createByteLimitedStream } from '../lib/server/streamLimit'

function makeByteStream(chunks: number[]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) {
        controller.enqueue(new Uint8Array(size))
      }
      controller.close()
    }
  })
}

async function consumeStream(stream: ReadableStream<Uint8Array>): Promise<number> {
  const reader = stream.getReader()
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value?.byteLength || 0
  }
  return total
}

test('createByteLimitedStream passes through data within limit', async () => {
  const limited = createByteLimitedStream(makeByteStream([2, 3, 1]), 8, () => {})
  const total = await consumeStream(limited)
  assert.equal(total, 6)
})

test('createByteLimitedStream errors and triggers callback when exceeding limit', async () => {
  let exceeded = false
  const limited = createByteLimitedStream(makeByteStream([4, 4]), 6, () => {
    exceeded = true
  })

  await assert.rejects(async () => consumeStream(limited))
  assert.equal(exceeded, true)
})
