import api from '@/lib/server/notion-api'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { unstable_cache } from '@/lib/server/runtimeCache'
import type { NotionDocument, TocItem } from '@jihuayu/notion-react'
import { normalizeNotionDocument, type RawNotionBlockCollection } from '@jihuayu/notion-react/normalize'

const NOTION_BLOCK_FETCH_CONCURRENCY = 6
const POST_BLOCKS_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS

export type { NotionDocument, TocItem }

interface BuildNotionDocumentOptions {
  includeToc?: boolean
}

async function collectDocumentBlocks(pageId: string): Promise<Record<string, RawNotionBlockCollection>> {
  const childrenByParentId: Record<string, RawNotionBlockCollection> = {}
  const pendingParentIds: string[] = [pageId]
  const visitedParents = new Set<string>()
  let inFlight = 0

  await new Promise<void>((resolve, reject) => {
    let settled = false

    const schedule = () => {
      if (settled) return

      if (pendingParentIds.length === 0 && inFlight === 0) {
        settled = true
        resolve()
        return
      }

      while (inFlight < NOTION_BLOCK_FETCH_CONCURRENCY && pendingParentIds.length > 0) {
        const parentId = pendingParentIds.shift()
        if (!parentId || visitedParents.has(parentId)) continue

        visitedParents.add(parentId)
        inFlight += 1

        api.listAllBlockChildren(parentId)
          .then((children) => {
            childrenByParentId[parentId] = children

            for (const block of children as any[]) {
              const blockId = `${block?.id || ''}`.trim()
              if (!blockId) continue

              if (block.has_children && !visitedParents.has(blockId)) {
                pendingParentIds.push(blockId)
              }
            }
          })
          .catch((error) => {
            if (settled) return
            settled = true
            reject(error)
          })
          .finally(() => {
            inFlight -= 1
            schedule()
          })
      }
    }

    schedule()
  })

  return childrenByParentId
}

export async function buildNotionDocument(
  pageId: string,
  { includeToc = true }: BuildNotionDocumentOptions = {}
): Promise<NotionDocument | null> {
  if (!pageId) return null

  const childBlocksByParentId = await collectDocumentBlocks(pageId)
  return normalizeNotionDocument({
    pageId,
    childBlocksByParentId,
    includeToc
  })
}

const getCachedDocument = unstable_cache(
  async (pageId: string) => buildNotionDocument(pageId, { includeToc: true }),
  ['notion-post-blocks'],
  { revalidate: POST_BLOCKS_CACHE_REVALIDATE_SECONDS, tags: ['notion-post-blocks'] }
)

export async function getPostBlocks(id: string): Promise<NotionDocument | null> {
  if (!id) return null
  return getCachedDocument(id)
}
