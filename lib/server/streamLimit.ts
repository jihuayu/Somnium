export function createByteLimitedStream(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
  onExceeded: () => void
): ReadableStream<Uint8Array> {
  let total = 0
  const limiter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, streamController) {
      total += chunk.byteLength
      if (total > maxBytes) {
        onExceeded()
        streamController.error(new Error('Byte limit exceeded'))
        return
      }
      streamController.enqueue(chunk)
    }
  })
  return body.pipeThrough(limiter)
}
