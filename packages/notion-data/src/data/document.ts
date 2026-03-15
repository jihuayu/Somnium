import type { NotionDocument } from '@jihuayu/notion-type'
import type { RawNotionBlockCollection } from '@jihuayu/notion-type/normalize'
import { normalizeNotionDocument } from '@jihuayu/notion-type/normalize'
import { DEFAULT_BLOCK_FETCH_CONCURRENCY } from './shared'
import type { BuildNotionDocumentOptions, NotionClient } from './types'

async function drainWithConcurrency<T>(
  initialItems: T[],
  concurrency: number,
  worker: (item: T, enqueue: (value: T) => void) => Promise<void>
): Promise<void> {
  const queue = [...initialItems]
  let activeCount = 0

  await new Promise<void>((resolve, reject) => {
    const runNext = () => {
      if (!queue.length && activeCount === 0) {
        resolve()
        return
      }

      while (activeCount < concurrency && queue.length > 0) {
        const item = queue.shift() as T
        activeCount += 1

        void worker(item, (value) => {
          queue.push(value)
        }).then(() => {
          activeCount -= 1
          runNext()
        }).catch(reject)
      }
    }

    runNext()
  })
}

interface NotionChildBlock {
  id?: string
  has_children?: boolean
}

async function collectDocumentBlocks(
  client: NotionClient,
  pageId: string,
  blockFetchConcurrency = DEFAULT_BLOCK_FETCH_CONCURRENCY
): Promise<Record<string, RawNotionBlockCollection>> {
  const childBlocksByParentId: Record<string, RawNotionBlockCollection> = {}
  const visitedParents = new Set<string>()

  await drainWithConcurrency([pageId], blockFetchConcurrency, async (parentId, enqueue) => {
    if (!parentId || visitedParents.has(parentId)) return

    visitedParents.add(parentId)
    const children = await client.listAllBlockChildren(parentId)
    childBlocksByParentId[parentId] = children

    for (const block of children as NotionChildBlock[]) {
      const blockId = `${block?.id || ''}`.trim()
      if (!blockId || !block.has_children || visitedParents.has(blockId)) continue
      enqueue(blockId)
    }
  })

  return childBlocksByParentId
}

export async function buildNotionDocument(
  client: NotionClient,
  pageId: string,
  { includeToc = true, blockFetchConcurrency = DEFAULT_BLOCK_FETCH_CONCURRENCY }: BuildNotionDocumentOptions = {}
): Promise<NotionDocument | null> {
  if (!pageId) return null
  const childBlocksByParentId = await collectDocumentBlocks(client, pageId, blockFetchConcurrency)
  return normalizeNotionDocument({
    pageId,
    childBlocksByParentId,
    includeToc
  })
}
