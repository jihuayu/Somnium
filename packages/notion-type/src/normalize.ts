import type { NotionBlock, NotionBlockType, NotionDocument } from './types'
import { buildTableOfContents } from './utils/notion'

const KNOWN_BLOCK_TYPES = new Set<NotionBlockType>([
  'paragraph', 'heading_1', 'heading_2', 'heading_3', 'quote', 'callout', 'equation', 'code', 'image',
  'column', 'column_list', 'toggle', 'template', 'tab', 'table_of_contents', 'link_to_page', 'child_page',
  'child_database', 'synced_block', 'breadcrumb', 'embed', 'bookmark', 'video', 'audio', 'pdf', 'file',
  'table', 'table_row', 'link_preview', 'divider', 'bulleted_list_item', 'numbered_list_item', 'to_do',
  'unsupported'
])

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

function isKnownBlockType(value: string): value is NotionBlockType {
  return KNOWN_BLOCK_TYPES.has(value as NotionBlockType)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasRichTextArrayPayload(value: unknown): value is { rich_text: unknown[] } {
  return isRecord(value) && Array.isArray(value.rich_text)
}

function hasStringField<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, string> {
  return isRecord(value) && typeof value[key] === 'string'
}

function hasBooleanField<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, boolean> {
  return isRecord(value) && typeof value[key] === 'boolean'
}

function hasNumberField<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, number> {
  return isRecord(value) && typeof value[key] === 'number'
}

function hasArrayField<TKey extends string>(value: unknown, key: TKey): value is Record<TKey, unknown[]> {
  return isRecord(value) && Array.isArray(value[key])
}

function isValidKnownBlockPayload(type: NotionBlockType, block: RawNotionBlock): boolean {
  switch (type) {
    case 'paragraph':
      return hasRichTextArrayPayload(block.paragraph)
    case 'heading_1':
      return hasRichTextArrayPayload(block.heading_1)
    case 'heading_2':
      return hasRichTextArrayPayload(block.heading_2)
    case 'heading_3':
      return hasRichTextArrayPayload(block.heading_3)
    case 'quote':
      return hasRichTextArrayPayload(block.quote)
    case 'callout':
      return hasRichTextArrayPayload(block.callout)
    case 'equation':
      return isRecord(block.equation)
    case 'code':
      return hasRichTextArrayPayload(block.code) && hasStringField(block.code, 'language')
    case 'image':
      return isRecord(block.image)
    case 'column':
      return isRecord(block.column)
    case 'toggle':
      return hasRichTextArrayPayload(block.toggle)
    case 'template':
      return hasRichTextArrayPayload(block.template)
    case 'tab':
      return isRecord(block.tab)
    case 'link_to_page':
      return isRecord(block.link_to_page)
    case 'child_page':
      return hasStringField(block.child_page, 'title')
    case 'child_database':
      return hasStringField(block.child_database, 'title')
    case 'synced_block':
      return isRecord(block.synced_block)
    case 'embed':
      return hasStringField(block.embed, 'url')
    case 'bookmark':
      return hasStringField(block.bookmark, 'url')
    case 'video':
      return isRecord(block.video)
    case 'audio':
      return isRecord(block.audio)
    case 'pdf':
      return isRecord(block.pdf)
    case 'file':
      return isRecord(block.file)
    case 'table':
      return isRecord(block.table)
        && hasNumberField(block.table, 'table_width')
        && hasBooleanField(block.table, 'has_column_header')
        && hasBooleanField(block.table, 'has_row_header')
    case 'table_row':
      return hasArrayField(block.table_row, 'cells')
    case 'link_preview':
      return hasStringField(block.link_preview, 'url')
    case 'bulleted_list_item':
      return hasRichTextArrayPayload(block.bulleted_list_item)
    case 'numbered_list_item':
      return hasRichTextArrayPayload(block.numbered_list_item)
    case 'to_do':
      return hasRichTextArrayPayload(block.to_do)
    case 'column_list':
    case 'tab':
    case 'table_of_contents':
    case 'breadcrumb':
    case 'divider':
    case 'unsupported':
      return true
    default:
      return true
  }
}

function toUnsupportedBlock(block: RawNotionBlock, id: string, rawType: string) {
  return {
    ...block,
    id,
    type: 'unsupported' as const,
    unsupported: { originalType: rawType }
  }
}

function toNormalizedBlock(block: RawNotionBlock, nestedChildrenKey: string): NotionBlock | null {
  const id = `${block?.id || ''}`.trim()
  if (!id) return null

  const rawType = `${block?.type || 'unsupported'}`.trim() || 'unsupported'
  const normalizedType = isKnownBlockType(rawType)
    ? rawType
    : 'unsupported'
  if (normalizedType !== 'unsupported' && !isValidKnownBlockPayload(normalizedType, block)) {
    const unsupportedBlock = toUnsupportedBlock(block, id, rawType)
    delete unsupportedBlock[nestedChildrenKey]
    return unsupportedBlock as NotionBlock
  }

  if (normalizedType === 'unsupported') {
    const unsupportedBlock = toUnsupportedBlock(block, id, rawType)
    delete unsupportedBlock[nestedChildrenKey]
    return unsupportedBlock as NotionBlock
  }

  const normalizedBlock = {
    ...block,
    id,
    type: normalizedType
  }
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