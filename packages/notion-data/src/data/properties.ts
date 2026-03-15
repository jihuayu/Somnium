import { buildInternalSlugHref } from '@jihuayu/notion-type'
import type {
  NotionDataSourcePropertyMatchMap,
  NotionDataSourcePropertyRef,
  NotionDataSourcePropertySchema,
  NotionFieldNameInput,
  NotionPageLike,
  NotionProperties
} from './types'
import { getPlainTextFromDirectoryRichText, toFieldNameList, unique } from './shared'

export function normalizeNotionUuid(id?: string): string {
  const raw = `${id || ''}`.trim()
  if (!raw) return ''

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return raw.toLowerCase()
  }

  const compact = raw.replaceAll('-', '')
  if (/^[0-9a-f]{32}$/i.test(compact)) {
    return [
      compact.slice(0, 8),
      compact.slice(8, 12),
      compact.slice(12, 16),
      compact.slice(16, 20),
      compact.slice(20)
    ].join('-').toLowerCase()
  }

  return raw
}

export function getPropertyByName<T>(properties: Record<string, T | undefined>, fieldName: string): T | null {
  if (!properties || !fieldName) return null
  if (properties[fieldName]) return properties[fieldName] || null

  const lowerFieldName = fieldName.toLowerCase()
  for (const [name, value] of Object.entries(properties)) {
    if (name.toLowerCase() === lowerFieldName) {
      return value || null
    }
  }

  return null
}

export function getPropertyByNames<T>(
  properties: Record<string, T | undefined>,
  fieldNames: NotionFieldNameInput
): T | null {
  for (const fieldName of toFieldNameList(fieldNames)) {
    const property = getPropertyByName(properties, fieldName)
    if (property) return property
  }
  return null
}

export function readNotionTextProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property) return ''

  switch (property.type) {
    case 'title':
      return getPlainTextFromDirectoryRichText(property.title || [])
    case 'rich_text':
      return getPlainTextFromDirectoryRichText(property.rich_text || [])
    case 'url':
      return `${property.url || ''}`.trim()
    default:
      return ''
  }
}

export function readNotionSelectProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string | null {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property) return null
  if (property.type === 'select') return property.select?.name || null
  if (property.type === 'status') return property.status?.name || null
  return null
}

export function readNotionMultiSelectProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string[] {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property || property.type !== 'multi_select') return []
  return unique((property.multi_select || []).map(item => `${item?.name || ''}`.trim()))
}

export function readNotionDateStartProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string | null {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

export function getPageParentDataSourceId(page: Pick<NotionPageLike, 'parent'>): string {
  const parent = page.parent
  if (!parent) return ''

  if (parent.type === 'data_source_id') {
    return normalizeNotionUuid(parent.data_source_id)
  }
  if (parent.type === 'database_id') {
    return normalizeNotionUuid(parent.database_id)
  }
  return ''
}

export function buildPagePathFromPage(page: Pick<NotionPageLike, 'properties'>, basePath = '', slugFieldName = 'slug'): string {
  const slug = getPlainTextFromDirectoryRichText(getPropertyByName(page.properties || {}, slugFieldName)?.rich_text || [])
  return slug ? buildInternalSlugHref(basePath, slug) : ''
}

export function findDataSourceProperty(
  properties: Record<string, NotionDataSourcePropertySchema | undefined>,
  candidateNames: string[],
  expectedType: string,
  allowFallbackByType = false
): NotionDataSourcePropertyRef | null {
  const normalizedCandidates = candidateNames.map(name => name.toLowerCase())
  const entries = Object.entries(properties || {})

  for (const [name, property] of entries) {
    if (!property || property.type !== expectedType) continue
    if (!normalizedCandidates.includes(name.toLowerCase())) continue
    return {
      id: property.id || name,
      type: property.type
    }
  }

  if (!allowFallbackByType) return null
  const fallback = entries.find(([, property]) => property?.type === expectedType)
  if (!fallback) return null

  return {
    id: fallback[1].id || fallback[0],
    type: fallback[1].type || expectedType
  }
}

export function resolveDataSourcePropertyRefs<T extends NotionDataSourcePropertyMatchMap>(
  properties: Record<string, NotionDataSourcePropertySchema | undefined>,
  rules: T
): { [K in keyof T]: NotionDataSourcePropertyRef | null } {
  const output = {} as { [K in keyof T]: NotionDataSourcePropertyRef | null }
  for (const key of Object.keys(rules) as Array<keyof T>) {
    const rule = rules[key]
    output[key] = findDataSourceProperty(properties, rule.names, rule.type, rule.allowFallbackByType)
  }
  return output
}

export function tokenizeSearchQuery(
  value: string,
  { maxTokens = 5, maxTokenLength = 32 }: { maxTokens?: number, maxTokenLength?: number } = {}
): string[] {
  if (!value) return []

  const seen = new Set<string>()
  const tokens: string[] = []
  for (const item of value.split(/\s+/)) {
    const token = item.trim().slice(0, maxTokenLength)
    if (!token || seen.has(token)) continue
    seen.add(token)
    tokens.push(token)
    if (tokens.length >= maxTokens) break
  }

  return tokens
}
