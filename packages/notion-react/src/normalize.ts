import type { NotionBlock, NotionDocument } from './types'
import { buildTableOfContents } from './utils/notion'

export interface RawNotionBlock extends Record<string, unknown> {
  id?: string
  type?: string
  has_children?: boolean
  children?: RawNotionBlock[] | null
}

export interface RawNotionListResponse<T = RawNotionBlock> {
  results?: T[] | null
}

export type RawNotionBlockCollection =
  | RawNotionBlock[]
  | RawNotionListResponse<RawNotionBlock>
  | null
  | undefined

export interface NormalizeNotionDocumentInput {
  pageId: string
  rootBlocks?: RawNotionBlockCollection
  childBlocksByParentId?: Record<string, RawNotionBlockCollection>
  includeToc?: boolean
  nestedChildrenKey?: string
}

function toRawBlockArray(input: RawNotionBlockCollection): RawNotionBlock[] {
  if (Array.isArray(input)) return input
  if (input && typeof input === 'object' && Array.isArray(input.results)) return input.results
  return []
}

function getNestedChildren(block: RawNotionBlock, nestedChildrenKey: string): RawNotionBlock[] {
  if (!block || typeof block !== 'object') return []
  const nestedChildren = block[nestedChildrenKey]
  return Array.isArray(nestedChildren) ? nestedChildren as RawNotionBlock[] : []
}

function toNormalizedBlock(block: RawNotionBlock, nestedChildrenKey: string): NotionBlock | null {
  const id = `${block?.id || ''}`.trim()
  if (!id) return null

  const normalizedType = `${block?.type || 'unsupported'}`.trim() || 'unsupported'
  const normalizedBlock = { ...block, id, type: normalizedType }
  delete normalizedBlock[nestedChildrenKey]

  return normalizedBlock as NotionBlock
}

export function normalizeNotionDocument({
  pageId,
  rootBlocks,
  childBlocksByParentId = {},
  includeToc = true,
  nestedChildrenKey = 'children'
}: NormalizeNotionDocumentInput): NotionDocument {
  const normalizedPageId = `${pageId || ''}`.trim()
  if (!normalizedPageId) {
    throw new Error('normalizeNotionDocument requires a pageId')
  }

  const blocksById: Record<string, NotionBlock> = {}
  const childrenById: Record<string, string[]> = {}
  const visitedParents = new Set<string>()

  const visitParent = (parentId: string, collection: RawNotionBlockCollection) => {
    if (visitedParents.has(parentId)) return
    visitedParents.add(parentId)

    const childIds: string[] = []
    for (const rawBlock of toRawBlockArray(collection)) {
      const normalizedBlock = toNormalizedBlock(rawBlock, nestedChildrenKey)
      if (!normalizedBlock) continue

      blocksById[normalizedBlock.id] = normalizedBlock
      childIds.push(normalizedBlock.id)

      const nestedChildren = getNestedChildren(rawBlock, nestedChildrenKey)
      if (nestedChildren.length > 0) {
        visitParent(normalizedBlock.id, nestedChildren)
        continue
      }

      if (Object.prototype.hasOwnProperty.call(childBlocksByParentId, normalizedBlock.id)) {
        visitParent(normalizedBlock.id, childBlocksByParentId[normalizedBlock.id])
        continue
      }

      if (normalizedBlock.has_children) {
        childrenById[normalizedBlock.id] = childrenById[normalizedBlock.id] || []
      }
    }

    childrenById[parentId] = childIds
  }

  const resolvedRootBlocks = rootBlocks !== undefined
    ? rootBlocks
    : childBlocksByParentId[normalizedPageId]

  visitParent(normalizedPageId, resolvedRootBlocks)

  const document: NotionDocument = {
    pageId: normalizedPageId,
    rootIds: childrenById[normalizedPageId] || [],
    blocksById,
    childrenById,
    toc: []
  }

  document.toc = includeToc ? buildTableOfContents(document) : []
  return document
}
