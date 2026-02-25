import api from '@/lib/server/notion-api'

function getBlockRichText(block) {
  if (!block || !block.type) return []
  const payload = block[block.type]
  if (!payload || typeof payload !== 'object') return []
  return payload.rich_text || []
}

function getPlainTextFromRichText(richText = []) {
  return richText.map(item => item?.plain_text || '').join('').trim()
}

function buildTableOfContents({ rootIds, blocksById, childrenById }) {
  const headingLevel = {
    heading_1: 0,
    heading_2: 1,
    heading_3: 2
  }

  const toc = []
  const walk = (blockIds = []) => {
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

async function buildDocument(pageId) {
  const blocksById = {}
  const childrenById = {}

  async function walk(parentId) {
    const children = await api.listAllBlockChildren(parentId)
    childrenById[parentId] = children.map(block => block.id)

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

const documentCache = new Map()

export async function getPostBlocks (id) {
  if (!id) return null
  if (documentCache.has(id)) {
    return documentCache.get(id)
  }

  const promise = buildDocument(id).catch(error => {
    documentCache.delete(id)
    throw error
  })

  documentCache.set(id, promise)
  return promise
}
