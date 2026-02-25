import api from '@/lib/server/notion-api'
import { unstable_cache } from 'next/cache'

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

async function buildDocument(pageId: string): Promise<NotionDocument> {
  const blocksById: Record<string, any> = {}
  const childrenById: Record<string, string[]> = {}

  async function walk(parentId: string) {
    const children = await api.listAllBlockChildren(parentId)
    childrenById[parentId] = children.map((block: any) => block.id)

    for (const block of children) {
      blocksById[block.id] = block
      if (block.has_children) {
        await walk(block.id)
      }
    }
  }

  await walk(pageId)

  const rootIds = childrenById[pageId] || []
  const toc = buildTableOfContents({ rootIds, blocksById, childrenById })

  return {
    pageId,
    rootIds,
    blocksById,
    childrenById,
    toc
  }
}

const getCachedDocument = unstable_cache(
  async (pageId: string) => buildDocument(pageId),
  ['notion-post-blocks'],
  { revalidate: 30, tags: ['notion-post-blocks'] }
)

export async function getPostBlocks(id: string): Promise<NotionDocument | null> {
  if (!id) return null
  return getCachedDocument(id)
}
