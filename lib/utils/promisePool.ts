export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const size = Math.max(1, Math.floor(concurrency || 1))
  if (!items.length) return []

  const results: R[] = new Array(items.length)
  let nextIndex = 0

  async function worker() {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) break
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  }

  const workerCount = Math.min(size, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  return results
}

export async function drainWithConcurrency<T>(
  initialItems: T[],
  concurrency: number,
  worker: (item: T, enqueue: (nextItem: T) => void, index: number) => Promise<void>
): Promise<void> {
  const size = Math.max(1, Math.floor(concurrency || 1))
  if (!initialItems.length) return

  const queue = [...initialItems]
  let nextIndex = 0

  const enqueue = (nextItem: T) => {
    queue.push(nextItem)
  }

  async function runner() {
    while (true) {
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= queue.length) break
      await worker(queue[currentIndex], enqueue, currentIndex)
    }
  }

  const workerCount = Math.min(size, queue.length)
  await Promise.all(Array.from({ length: workerCount }, () => runner()))
}
