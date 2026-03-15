import type {
  NotionDirectoryPageIcon,
  NotionDirectoryPageLike,
  NotionDirectoryProperty,
  NotionDirectoryTreeBuildOptions,
  NotionDirectoryTreeEntry,
  NotionDirectoryTreeNode,
  NotionDirectoryTreeRefreshInput,
  NotionDirectoryTreeRefreshResult,
  NotionDirectoryTreeSnapshot,
  NotionDirectoryTreeWebhookPayload
} from './types'
import {
  buildNotionPublicUrl,
  extractNotionPageIdFromUrl,
  getFileBlockUrl,
  normalizeNotionEntityId,
  normalizeRichTextUrl
} from './utils/notion'

const DEFAULT_FIELD_NAMES = {
  title: ['title', 'name'],
  desc: ['description', 'desc', 'summary'],
  tag: ['tags', 'tag'],
  url: ['url', 'link', 'href', 'slug'],
  icon: ['icon'],
  parent: ['parent', 'parent_id', 'parent page', 'parent_page']
} as const

const WEBHOOK_UPSERT_EVENTS = new Set([
  'page.created',
  'page.undeleted',
  'page.content_updated',
  'page.properties_updated',
  'page.moved'
])

const WEBHOOK_DELETE_EVENTS = new Set([
  'page.deleted'
])

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values.map(value => `${value || ''}`.trim()).filter(Boolean)))
}

function toFieldNames(value: string | string[] | undefined, fallback: readonly string[]): string[] {
  if (Array.isArray(value)) return uniqueStrings(value)
  if (typeof value === 'string') return uniqueStrings([value])
  return [...fallback]
}

function normalizeTreeId(rawId?: string | null): string {
  const raw = `${rawId || ''}`.trim()
  if (!raw) return ''
  return normalizeNotionEntityId(raw) || raw
}

function getPropertyByName(
  properties: Record<string, NotionDirectoryProperty | undefined> | undefined,
  fieldNames: readonly string[]
): NotionDirectoryProperty | null {
  if (!properties) return null
  const entries = Object.entries(properties)
  for (const fieldName of fieldNames) {
    const normalizedFieldName = fieldName.toLowerCase()
    for (const [propertyName, property] of entries) {
      if (propertyName.toLowerCase() === normalizedFieldName) {
        return property || null
      }
    }
  }
  return null
}

function getPlainTextFromDirectoryRichText(items: Array<{ plain_text?: string | null }> = []): string {
  return items.map(item => `${item?.plain_text || ''}`).join('').trim()
}

function readFormulaValue(property: NotionDirectoryProperty | null): string {
  const formula = property?.formula
  if (!formula || typeof formula !== 'object') return ''
  switch (formula.type) {
    case 'string':
      return `${formula.string || ''}`.trim()
    case 'number':
      return formula.number == null ? '' : `${formula.number}`
    case 'boolean':
      return formula.boolean == null ? '' : `${formula.boolean}`
    default:
      return ''
  }
}

function readTextProperty(property: NotionDirectoryProperty | null): string {
  if (!property || typeof property !== 'object') return ''

  switch (`${property.type || ''}`) {
    case 'title':
      return getPlainTextFromDirectoryRichText(property.title || [])
    case 'rich_text':
      return getPlainTextFromDirectoryRichText(property.rich_text || [])
    case 'url':
      return `${property.url || ''}`.trim()
    case 'select':
      return `${property.select?.name || ''}`.trim()
    case 'status':
      return `${property.status?.name || ''}`.trim()
    case 'formula':
      return readFormulaValue(property)
    default:
      return getPlainTextFromDirectoryRichText(property.rich_text || property.title || [])
  }
}

function readTagProperty(property: NotionDirectoryProperty | null): string[] {
  if (!property || typeof property !== 'object') return []
  switch (`${property.type || ''}`) {
    case 'multi_select':
      return uniqueStrings((property.multi_select || []).map(option => `${option?.name || ''}`))
    case 'select':
      return uniqueStrings([`${property.select?.name || ''}`])
    case 'status':
      return uniqueStrings([`${property.status?.name || ''}`])
    default: {
      const text = readTextProperty(property)
      return text ? [text] : []
    }
  }
}

function readIconFromPageIcon(icon: NotionDirectoryPageIcon | null | undefined): string {
  if (!icon || typeof icon !== 'object') return ''
  switch (icon.type) {
    case 'emoji':
      return `${icon.emoji || ''}`.trim()
    case 'external':
      return `${icon.external?.url || ''}`.trim()
    case 'file':
      return `${icon.file?.url || ''}`.trim()
    default:
      return ''
  }
}

function readIconProperty(property: NotionDirectoryProperty | null): string {
  if (!property || typeof property !== 'object') return ''
  if (`${property.type || ''}` === 'files') {
    return getFileBlockUrl((property.files || [])[0] || null)
  }
  return readTextProperty(property)
}

function readParentId(property: NotionDirectoryProperty | null): string {
  if (!property || typeof property !== 'object') return ''
  if (`${property.type || ''}` === 'relation') {
    return normalizeTreeId(property.relation?.[0]?.id)
  }

  const raw = readTextProperty(property)
  if (!raw) return ''
  return extractNotionPageIdFromUrl(raw) || normalizeTreeId(raw)
}

function resolveDefaultUrl(page: NotionDirectoryPageLike, fieldUrl: string): string {
  const trimmedFieldUrl = `${fieldUrl || ''}`.trim()
  if (trimmedFieldUrl.startsWith('/')) return trimmedFieldUrl

  const normalizedFieldUrl = normalizeRichTextUrl(fieldUrl)
  if (normalizedFieldUrl) return normalizedFieldUrl
  const pageUrl = normalizeRichTextUrl(page.url || '')
  if (pageUrl) return pageUrl
  const normalizedId = normalizeNotionEntityId(page.id)
  return normalizedId ? buildNotionPublicUrl(normalizedId) : trimmedFieldUrl
}

function buildDirectoryEntry(
  page: NotionDirectoryPageLike,
  options: NotionDirectoryTreeBuildOptions = {}
): NotionDirectoryTreeEntry | null {
  const id = normalizeTreeId(page.id)
  if (!id) return null

  const fieldNames = options.fieldNames || {}
  const titleProperty = getPropertyByName(page.properties, toFieldNames(fieldNames.title, DEFAULT_FIELD_NAMES.title))
  const descProperty = getPropertyByName(page.properties, toFieldNames(fieldNames.desc, DEFAULT_FIELD_NAMES.desc))
  const tagProperty = getPropertyByName(page.properties, toFieldNames(fieldNames.tag, DEFAULT_FIELD_NAMES.tag))
  const urlProperty = getPropertyByName(page.properties, toFieldNames(fieldNames.url, DEFAULT_FIELD_NAMES.url))
  const iconProperty = getPropertyByName(page.properties, toFieldNames(fieldNames.icon, DEFAULT_FIELD_NAMES.icon))
  const parentProperty = getPropertyByName(page.properties, toFieldNames(fieldNames.parent, DEFAULT_FIELD_NAMES.parent))

  const title = readTextProperty(titleProperty)
  const desc = readTextProperty(descProperty)
  const tag = readTagProperty(tagProperty)
  const baseEntry = {
    id,
    title,
    desc,
    tag,
    icon: '',
    url: ''
  }

  const defaultParentId = readParentId(parentProperty)
  const parentId = normalizeTreeId(options.resolveParentId?.(page, baseEntry) || defaultParentId)
  const resolvedUrl = `${options.resolveUrl?.(page, { ...baseEntry, parentId }) || ''}`.trim()
  const url = resolvedUrl || resolveDefaultUrl(page, readTextProperty(urlProperty))
  const resolvedIcon = `${options.resolveIcon?.(page, { ...baseEntry, parentId }) || ''}`.trim()
  const icon = resolvedIcon || readIconFromPageIcon(page.icon) || readIconProperty(iconProperty)

  return {
    id,
    title,
    desc,
    tag,
    url,
    icon,
    parentId
  }
}

function sortDirectoryTree(
  nodes: NotionDirectoryTreeNode[],
  comparator?: (left: NotionDirectoryTreeNode, right: NotionDirectoryTreeNode) => number
) {
  const compare = comparator || ((left: NotionDirectoryTreeNode, right: NotionDirectoryTreeNode) => {
    return left.title.localeCompare(right.title, 'zh-CN') || left.id.localeCompare(right.id, 'en')
  })

  nodes.sort(compare)
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortDirectoryTree(node.children, comparator)
    }
  }
}

function createsCycle(
  entryId: string,
  parentId: string,
  entriesById: Record<string, NotionDirectoryTreeEntry>
): boolean {
  let currentId = parentId
  const visited = new Set<string>()

  while (currentId) {
    if (currentId === entryId) return true
    if (visited.has(currentId)) return true
    visited.add(currentId)
    currentId = entriesById[currentId]?.parentId || ''
  }

  return false
}

function buildSnapshotFromEntries(
  entriesById: Record<string, NotionDirectoryTreeEntry>,
  options: NotionDirectoryTreeBuildOptions = {}
): NotionDirectoryTreeSnapshot {
  const normalizedEntries = Object.fromEntries(
    Object.values(entriesById)
      .filter(entry => entry?.id)
      .map(entry => [entry.id, { ...entry, tag: [...entry.tag] }])
  )

  const nodesById: Record<string, NotionDirectoryTreeNode> = {}
  for (const entry of Object.values(normalizedEntries)) {
    nodesById[entry.id] = {
      id: entry.id,
      title: entry.title,
      desc: entry.desc,
      tag: [...entry.tag],
      url: entry.url,
      icon: entry.icon,
      children: []
    }
  }

  const roots: NotionDirectoryTreeNode[] = []
  for (const entry of Object.values(normalizedEntries)) {
    const node = nodesById[entry.id]
    const parentId = normalizeTreeId(entry.parentId)
    if (!parentId || !nodesById[parentId] || createsCycle(entry.id, parentId, normalizedEntries)) {
      roots.push(node)
      continue
    }

    nodesById[parentId].children.push(node)
  }

  sortDirectoryTree(roots, options.sortChildren)

  return {
    roots,
    nodesById,
    entriesById: normalizedEntries
  }
}

function getWebhookEventType(payload: NotionDirectoryTreeWebhookPayload): string {
  return `${payload.type || ''}`.trim()
}

function getWebhookEntityId(payload: NotionDirectoryTreeWebhookPayload): string {
  return normalizeTreeId(payload.entity?.id)
}

function isVerificationRequest(payload: NotionDirectoryTreeWebhookPayload): boolean {
  return !!`${payload.verification_token || ''}`.trim() && !getWebhookEventType(payload)
}

function createRefreshResult(
  snapshot: NotionDirectoryTreeSnapshot,
  reason: string,
  changed: boolean,
  requiresFullRefresh = false
): NotionDirectoryTreeRefreshResult {
  return {
    snapshot,
    changed,
    requiresFullRefresh,
    reason
  }
}

export function buildNotionDirectoryTreeSnapshot(
  pages: NotionDirectoryPageLike[],
  options: NotionDirectoryTreeBuildOptions = {}
): NotionDirectoryTreeSnapshot {
  const entriesById: Record<string, NotionDirectoryTreeEntry> = {}
  for (const page of pages || []) {
    const entry = buildDirectoryEntry(page, options)
    if (!entry) continue
    entriesById[entry.id] = entry
  }
  return buildSnapshotFromEntries(entriesById, options)
}

export function buildNotionDirectoryTree(
  pages: NotionDirectoryPageLike[],
  options: NotionDirectoryTreeBuildOptions = {}
): NotionDirectoryTreeNode[] {
  return buildNotionDirectoryTreeSnapshot(pages, options).roots
}

export function refreshNotionDirectoryTreeSnapshot(
  currentSnapshot: NotionDirectoryTreeSnapshot,
  input: NotionDirectoryTreeRefreshInput,
  options: NotionDirectoryTreeBuildOptions = {}
): NotionDirectoryTreeRefreshResult {
  if (input.mode === 'full') {
    return createRefreshResult(
      buildNotionDirectoryTreeSnapshot(input.pages, options),
      'full-refresh',
      true
    )
  }

  if (input.pages?.length) {
    return createRefreshResult(
      buildNotionDirectoryTreeSnapshot(input.pages, options),
      'webhook-full-refresh',
      true
    )
  }

  const payload = input.payload || {}
  if (isVerificationRequest(payload)) {
    return createRefreshResult(currentSnapshot, 'verification', false)
  }

  const eventType = getWebhookEventType(payload)
  if (!eventType) {
    return createRefreshResult(currentSnapshot, 'missing-event-type', false)
  }

  if (eventType.startsWith('data_source.') || eventType.startsWith('database.')) {
    return createRefreshResult(currentSnapshot, 'requires-full-refresh', false, true)
  }

  if (!eventType.startsWith('page.')) {
    return createRefreshResult(currentSnapshot, 'ignored-event-type', false)
  }

  const entityId = getWebhookEntityId(payload)
  if (!entityId) {
    return createRefreshResult(currentSnapshot, 'missing-entity-id', false, true)
  }

  if (WEBHOOK_DELETE_EVENTS.has(eventType)) {
    if (!currentSnapshot.entriesById[entityId]) {
      return createRefreshResult(currentSnapshot, 'noop-delete', false)
    }

    const entriesById = { ...currentSnapshot.entriesById }
    delete entriesById[entityId]
    return createRefreshResult(buildSnapshotFromEntries(entriesById, options), 'page-deleted', true)
  }

  if (!WEBHOOK_UPSERT_EVENTS.has(eventType)) {
    return createRefreshResult(currentSnapshot, 'ignored-page-event', false)
  }

  if (!input.page) {
    return createRefreshResult(currentSnapshot, 'missing-page-payload', false, true)
  }

  const entry = buildDirectoryEntry(input.page, options)
  if (!entry) {
    return createRefreshResult(currentSnapshot, 'invalid-page-payload', false, true)
  }

  const entriesById = {
    ...currentSnapshot.entriesById,
    [entry.id]: entry
  }

  return createRefreshResult(buildSnapshotFromEntries(entriesById, options), 'page-upserted', true)
}