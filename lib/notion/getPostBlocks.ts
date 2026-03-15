import { notionClient } from '@/lib/server/notionData'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { unstable_cache } from 'next/cache'
import type { NotionDocument, TocItem } from '@jihuayu/notion-type'
import { buildNotionDocument as buildNotionDocumentBase, type BuildNotionDocumentOptions, type NotionClient } from '@jihuayu/notion-data'

const POST_BLOCKS_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS

export type { NotionDocument, TocItem }

interface NotionBlocksDependencies {
  apiClient?: NotionClient
}

export async function buildNotionDocument(
  pageId: string,
  { includeToc = true }: BuildNotionDocumentOptions = {},
  { apiClient = notionClient }: NotionBlocksDependencies = {}
): Promise<NotionDocument | null> {
  if (!pageId) return null
  return buildNotionDocumentBase(apiClient, pageId, {
    includeToc,
    blockFetchConcurrency: 6
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
