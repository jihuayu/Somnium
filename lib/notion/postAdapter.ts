import dayjs from '@/lib/dayjs'
import { config as BLOG } from '@/lib/server/config'
import {
  normalizeNotionUuid,
  readNotionDateStartProperty,
  readNotionMultiSelectProperty,
  readNotionSelectProperty,
  readNotionTextProperty,
  type BuildPagePreviewMapOptions,
  type NotionPageLike,
  type NotionPagePreviewSource
} from '@jihuayu/notion-data'
import type { PageHrefMap, PagePreviewMap } from '@jihuayu/notion-type'
import { buildPagePreviewMap } from '@jihuayu/notion-data'
import type { PostData } from './filterPublishedPosts'

export { normalizeNotionUuid } from '@jihuayu/notion-data'

export interface PostFieldNames {
  title: string | string[]
  slug: string | string[]
  summary: string | string[]
  type: string | string[]
  status: string | string[]
  tags: string | string[]
  date: string | string[]
}

export const BLOG_POST_FIELD_NAMES: PostFieldNames = {
  title: ['title', 'name'],
  slug: 'slug',
  summary: ['summary', 'description'],
  type: 'type',
  status: 'status',
  tags: ['tags', 'tag'],
  date: 'date'
}

interface MapPageToPostOptions {
  timeZone?: string
  fieldNames?: Partial<PostFieldNames>
}

function normalizeSingleSelect(value: string | null): string[] {
  return value ? [value] : []
}

function resolveFieldNames(overrides: Partial<PostFieldNames> = {}): PostFieldNames {
  return {
    ...BLOG_POST_FIELD_NAMES,
    ...overrides
  }
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

  if (!page.properties || typeof page.properties !== 'object') {
    throw new Error(`Notion page ${page.id} is missing properties`)
  }

  if (!page.parent || typeof page.parent !== 'object') {
    throw new Error(`Notion page ${page.id} is missing parent`)
  }
}

export function mapNotionPageToPost(
  page: NotionPageLike,
  { timeZone = BLOG.timezone, fieldNames: fieldNameOverrides }: MapPageToPostOptions = {}
): PostData {
  assertValidNotionPage(page)
  const fieldNames = resolveFieldNames(fieldNameOverrides)
  const properties = page.properties

  const title = readNotionTextProperty(properties, fieldNames.title)
  const slug = readNotionTextProperty(properties, fieldNames.slug)
  const summary = readNotionTextProperty(properties, fieldNames.summary)
  const type = readNotionSelectProperty(properties, fieldNames.type)
  const status = readNotionSelectProperty(properties, fieldNames.status)
  const tags = readNotionMultiSelectProperty(properties, fieldNames.tags)

  const dateStart = readNotionDateStartProperty(properties, fieldNames.date)
  const date = dateStart
    ? dayjs.tz(dateStart, timeZone).valueOf()
    : dayjs(page.created_time).valueOf()

  return {
    id: page.id,
    title,
    slug,
    summary,
    tags,
    type: normalizeSingleSelect(type),
    status: normalizeSingleSelect(status),
    fullWidth: false,
    date
  }
}

export function mapPostsToPreviewSources(posts: Array<Pick<PostData, 'id' | 'title' | 'summary'>>): NotionPagePreviewSource[] {
  return (posts || []).map(post => ({
    id: post.id,
    title: post.title,
    summary: post.summary
  }))
}

export function buildPostPagePreviewMap(
  posts: Array<Pick<PostData, 'id' | 'title' | 'summary'>>,
  pageHrefMap: PageHrefMap,
  options: BuildPagePreviewMapOptions
): PagePreviewMap {
  return buildPagePreviewMap(mapPostsToPreviewSources(posts), pageHrefMap, options)
}

export function collectNormalizedPostIds(posts: Array<Pick<PostData, 'id'>>): string[] {
  return (posts || [])
    .map(post => normalizeNotionUuid(post.id))
    .filter(Boolean)
}