import dayjs from '@/lib/dayjs'
import { config as BLOG } from '@/lib/server/config'
import type { PostData } from './filterPublishedPosts'

export function normalizeNotionUuid(id?: string): string {
  const raw = id?.trim()
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

export function getPropertyByName(properties: Record<string, any>, fieldName: string): any {
  if (!properties || !fieldName) return null
  if (properties[fieldName]) return properties[fieldName]

  const lowerFieldName = fieldName.toLowerCase()
  for (const [name, value] of Object.entries(properties)) {
    if (name.toLowerCase() === lowerFieldName) {
      return value
    }
  }

  return null
}

function getPlainTextFromRichText(richText: any[] = []): string {
  return richText.map(item => item?.plain_text || '').join('')
}

function getSelectPropertyValue(property: any): string | null {
  if (!property) return null
  if (property.type === 'select') {
    return property.select?.name || null
  }
  if (property.type === 'status') {
    return property.status?.name || null
  }
  return null
}

function getDatePropertyStart(property: any): string | null {
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

export function mapPageToPost(page: any): PostData {
  const properties = page?.properties || {}

  const title = getPlainTextFromRichText(
    getPropertyByName(properties, 'title')?.title || []
  )
  const slug = getPlainTextFromRichText(
    getPropertyByName(properties, 'slug')?.rich_text || []
  )
  const summary = getPlainTextFromRichText(
    getPropertyByName(properties, 'summary')?.rich_text || []
  )

  const type = getSelectPropertyValue(getPropertyByName(properties, 'type'))
  const status = getSelectPropertyValue(getPropertyByName(properties, 'status'))
  const tags = (getPropertyByName(properties, 'tags')?.multi_select || [])
    .map((item: any) => item?.name)
    .filter(Boolean) as string[]

  const dateStart = getDatePropertyStart(getPropertyByName(properties, 'date'))
  const date = dateStart
    ? dayjs.tz(dateStart, BLOG.timezone).valueOf()
    : dayjs(page?.created_time).valueOf()

  return {
    id: page?.id,
    title,
    slug,
    summary,
    tags,
    type: type ? [type] : [],
    status: status ? [status] : [],
    fullWidth: false,
    date
  }
}

export function getPageParentDataSourceId(page: any): string {
  const parent = page?.parent
  if (!parent) return ''

  if (parent.type === 'data_source_id') {
    return normalizeNotionUuid(parent.data_source_id)
  }
  if (parent.type === 'database_id') {
    return normalizeNotionUuid(parent.database_id)
  }
  return ''
}
