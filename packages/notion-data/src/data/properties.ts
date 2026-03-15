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

/**
 * EN: Normalizes a Notion entity id into canonical UUID format.
 * ZH: 将 Notion 实体 ID 标准化为规范 UUID 形式。
 */
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

/**
 * EN: Finds a property by exact/case-insensitive name.
 * ZH: 按精确名或大小写不敏感方式查找属性。
 */
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

/**
 * EN: Finds the first matched property from multiple candidate names.
 * ZH: 从多个候选字段名中返回首个匹配属性。
 */
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

/**
 * EN: Reads title/rich_text/url property value as plain text.
 * ZH: 读取 title/rich_text/url 类型属性的文本值。
 */
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

/**
 * EN: Reads select/status property value.
 * ZH: 读取 select/status 类型属性值。
 */
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

/**
 * EN: Reads multi-select property values.
 * ZH: 读取 multi_select 类型属性值列表。
 */
export function readNotionMultiSelectProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string[] {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property || property.type !== 'multi_select') return []
  return unique((property.multi_select || []).map(item => `${item?.name || ''}`.trim()))
}

/**
 * EN: Reads date.start from a date property.
 * ZH: 读取 date 类型属性中的 start 字段。
 */
export function readNotionDateStartProperty(
  properties: NotionProperties,
  fieldNames: NotionFieldNameInput
): string | null {
  const property = getPropertyByNames(properties, fieldNames)
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

/**
 * EN: Resolves parent data source id from a page parent reference.
 * ZH: 从页面 parent 引用中提取所属数据源 ID。
 */
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

/**
 * EN: Builds an internal page path from the page slug property.
 * ZH: 基于页面 slug 属性生成内部路径。
 */
export function buildPagePathFromPage(page: Pick<NotionPageLike, 'properties'>, basePath = '', slugFieldName = 'slug'): string {
  const slug = getPlainTextFromDirectoryRichText(getPropertyByName(page.properties || {}, slugFieldName)?.rich_text || [])
  return slug ? buildInternalSlugHref(basePath, slug) : ''
}

/**
 * EN: Finds a data source property by candidate names and expected type.
 * ZH: 按候选字段名与期望类型匹配数据源属性。
 */
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

/**
 * EN: Resolves multiple data source property references by rule map.
 * ZH: 根据规则映射批量解析数据源属性引用。
 */
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

/**
 * EN: Tokenizes search text for building Notion query filters.
 * ZH: 对搜索文本分词，用于构建 Notion 查询过滤器。
 */
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
