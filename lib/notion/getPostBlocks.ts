import api from '@/lib/server/notion-api'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { unstable_cache } from 'next/cache'
import type { NotionDocument, TocItem } from '@jihuayu/notion-react'
import { normalizeNotionDocument, type RawNotionBlockCollection } from '@jihuayu/notion-react/normalize'
import { drainWithConcurrency } from '@/lib/utils/promisePool'

const NOTION_BLOCK_FETCH_CONCURRENCY = 6
const POST_BLOCKS_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS

export type { NotionDocument, TocItem }

interface BuildNotionDocumentOptions {
  includeToc?: boolean
}

interface NotionBlocksDependencies {
  apiClient?: Pick<typeof api, 'listAllBlockChildren'>
}

interface NotionChildBlock {
  id?: string
  has_children?: boolean
}

async function collectDocumentBlocks(
  pageId: string,
  { apiClient = api }: NotionBlocksDependencies = {}
): Promise<Record<string, RawNotionBlockCollection>> {
  const childrenByParentId: Record<string, RawNotionBlockCollection> = {}
  const visitedParents = new Set<string>()

  await drainWithConcurrency([pageId], NOTION_BLOCK_FETCH_CONCURRENCY, async (parentId, enqueue) => {
    if (!parentId || visitedParents.has(parentId)) return

    visitedParents.add(parentId)
    const children = await apiClient.listAllBlockChildren(parentId)
    childrenByParentId[parentId] = children

    for (const block of children as NotionChildBlock[]) {
      const blockId = `${block?.id || ''}`.trim()
      if (!blockId || !block.has_children || visitedParents.has(blockId)) continue
      enqueue(blockId)
    }
  })

  return childrenByParentId
}

export async function buildNotionDocument(
  pageId: string,
  { includeToc = true }: BuildNotionDocumentOptions = {},
  dependencies?: NotionBlocksDependencies
): Promise<NotionDocument | null> {
  if (!pageId) return null

  const childBlocksByParentId = await collectDocumentBlocks(pageId, dependencies)
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
