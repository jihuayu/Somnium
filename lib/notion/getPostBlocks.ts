import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { getAtriumBlogClient, isAtriumBlogNotFoundError, type AtriumBlogClient } from '@/lib/server/atriumBlog'
import { unstable_cache } from 'next/cache'
import type { NotionDocument, TocItem } from '@jihuayu/notion-type'

const POST_BLOCKS_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS

export type { NotionDocument, TocItem }

export interface BuildNotionDocumentOptions {
  includeToc?: boolean
}

export interface AtriumBlocksDependencies {
  client?: Pick<AtriumBlogClient, 'getPostDocument'>
}

export async function buildNotionDocument(
  pageId: string,
  { includeToc = true }: BuildNotionDocumentOptions = {},
  { client = getAtriumBlogClient() }: AtriumBlocksDependencies = {}
): Promise<NotionDocument | null> {
  if (!pageId) return null
  try {
    const document = await client.getPostDocument(pageId)
    return includeToc ? document : { ...document, toc: undefined }
  } catch (error) {
    if (isAtriumBlogNotFoundError(error)) return null
    throw error
  }
}

const getCachedDocument = unstable_cache(
  async (pageId: string) => buildNotionDocument(pageId, { includeToc: true }),
  ['atrium-blog-post-blocks'],
  { revalidate: POST_BLOCKS_CACHE_REVALIDATE_SECONDS, tags: ['atrium-blog-documents'] }
)

export async function getPostBlocks(id: string): Promise<NotionDocument | null> {
  if (!id) return null
  return getCachedDocument(id)
}
