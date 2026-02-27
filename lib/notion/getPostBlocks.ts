import api from '@/lib/server/notion-api'
import { unstable_cache } from 'next/cache'

const NOTION_BLOCK_FETCH_CONCURRENCY = 6
const POST_BLOCKS_CACHE_REVALIDATE_SECONDS = 30

export interface TocItem {
  id: string
  text: string
  indentLevel: number
}

export interface NotionDocument {
  pageId: string
  rootIds: string[]
  blocksById: Record<string, any>
  childrenById: Record<string, string[]>
  toc: TocItem[]
}

interface BuildNotionDocumentOptions {
  includeToc?: boolean
}

function getBlockRichText(block: any): any[] {
  if (!block || !block.type) return []
  const payload = block[block.type]
  if (!payload || typeof payload !== 'object') return []
  return payload.rich_text || []
}

function getPlainTextFromRichText(richText: any[] = []): string {
  return richText.map(item => item?.plain_text || '').join('').trim()
}

function buildTableOfContents({ rootIds, blocksById, childrenById }: {
  rootIds: string[]
  blocksById: Record<string, any>
  childrenById: Record<string, string[]>
}): TocItem[] {
  const headingLevel: Record<string, number> = {
    heading_1: 0,
    heading_2: 1,
    heading_3: 2
  }

  const toc: TocItem[] = []
  const walk = (blockIds: string[] = []) => {
    for (const blockId of blockIds) {
      const block = blocksById[blockId]
      if (!block) continue

      if (Object.hasOwn(headingLevel, block.type)) {
        const text = getPlainTextFromRichText(getBlockRichText(block))
        if (text) {
          toc.push({
            id: block.id,
            text,
            indentLevel: headingLevel[block.type]
          })
        }
      }

      walk(childrenById[blockId] || [])
    }
  }

  walk(rootIds)
  return toc
}

async function collectDocumentBlocks(pageId: string): Promise<{
  blocksById: Record<string, any>
  childrenById: Record<string, string[]>
}> {
  const blocksById: Record<string, any> = {}
  const childrenById: Record<string, string[]> = {}
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
            childrenById[parentId] = children
              .map((block: any) => `${block?.id || ''}`.trim())
              .filter(Boolean)

            for (const block of children) {
              const blockId = `${block?.id || ''}`.trim()
              if (!blockId) continue

              blocksById[blockId] = block
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

  return {
    blocksById,
    childrenById
  }
}

export async function buildNotionDocument(
  pageId: string,
  { includeToc = true }: BuildNotionDocumentOptions = {}
): Promise<NotionDocument | null> {
  if (!pageId) return null

  const { blocksById, childrenById } = await collectDocumentBlocks(pageId)

  const rootIds = childrenById[pageId] || []
  const toc = includeToc
    ? buildTableOfContents({ rootIds, blocksById, childrenById })
    : []

  return {
    pageId,
    rootIds,
    blocksById,
    childrenById,
    toc
  }
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
