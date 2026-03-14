import dayjs from '@/lib/dayjs'
import { config as BLOG } from '@/lib/server/config'
import type { PostData } from './filterPublishedPosts'

interface MapPageToPostOptions {
  timeZone?: string
}

interface NotionRichTextItem {
  plain_text?: string | null
}

interface NotionSelectOption {
  name?: string | null
}

export interface NotionProperty {
  type?: string
  title?: NotionRichTextItem[]
  rich_text?: NotionRichTextItem[]
  select?: NotionSelectOption | null
  status?: NotionSelectOption | null
  multi_select?: NotionSelectOption[]
  date?: {
    start?: string | null
  } | null
}

export type NotionProperties = Record<string, NotionProperty | undefined>

export interface NotionPageParent {
  type?: string
  data_source_id?: string
  database_id?: string
}

export interface NotionPageLike {
  id: string
  created_time: string
  last_edited_time: string
  properties: NotionProperties
  parent?: NotionPageParent | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertValidNotionPage(page: NotionPageLike): void {
  if (!`${page.id || ''}`.trim()) {
    throw new Error('Notion page is missing a valid id')
  }

  if (!`${page.created_time || ''}`.trim()) {
    throw new Error(`Notion page ${page.id} is missing created_time`)
  }

  if (!`${page.last_edited_time || ''}`.trim()) {
    throw new Error(`Notion page ${page.id} is missing last_edited_time`)
  }

  if (!isRecord(page.properties)) {
    throw new Error(`Notion page ${page.id} is missing properties`)
  }

  if (!isRecord(page.parent)) {
    throw new Error(`Notion page ${page.id} is missing parent`)
  }
}

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

export function getPropertyByName<T>(properties: Record<string, T | undefined>, fieldName: string): T | null {
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

function getPlainTextFromRichText(richText: NotionRichTextItem[] = []): string {
  return richText.map(item => item?.plain_text || '').join('')
}

function getSelectPropertyValue(property: NotionProperty | null): string | null {
  if (!property) return null
  if (property.type === 'select') {
    return property.select?.name || null
  }
  if (property.type === 'status') {
    return property.status?.name || null
  }
  return null
}

function getDatePropertyStart(property: NotionProperty | null): string | null {
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

export function mapPageToPost(page: NotionPageLike, { timeZone = BLOG.timezone }: MapPageToPostOptions = {}): PostData {
  assertValidNotionPage(page)
  const properties = page.properties

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
    .map(item => item?.name || '')
    .filter((item): item is string => !!item)

  const dateStart = getDatePropertyStart(getPropertyByName(properties, 'date'))
  const date = dateStart
    ? dayjs.tz(dateStart, timeZone).valueOf()
    : dayjs(page.created_time).valueOf()

  return {
    id: page.id,
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
