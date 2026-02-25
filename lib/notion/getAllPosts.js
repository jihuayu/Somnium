import { config as BLOG } from '@/lib/server/config'

import dayjs from '@/lib/dayjs'
import api from '@/lib/server/notion-api'
import filterPublishedPosts from './filterPublishedPosts'

function getPropertyByName(properties, fieldName) {
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

function getPlainTextFromRichText(richText = []) {
  return richText.map(item => item?.plain_text || '').join('')
}

function getSelectPropertyValue(property) {
  if (!property) return null
  if (property.type === 'select') {
    return property.select?.name || null
  }
  if (property.type === 'status') {
    return property.status?.name || null
  }
  return null
}

function getDatePropertyStart(property) {
  if (!property || property.type !== 'date') return null
  return property.date?.start || null
}

function mapPageToPost(page) {
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
    .map(item => item?.name)
    .filter(Boolean)

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

/**
 * @param {{ includePages: boolean }} - false: posts only / true: include pages
 */
export async function getAllPosts ({ includePages = false }) {
  const dataSourceId = process.env.NOTION_DATA_SOURCE_ID?.trim()
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const pages = await api.queryAllDataSourcePages(dataSourceId)
  const data = pages.map(mapPageToPost).filter(post => post?.id)

  // remove all the the items doesn't meet requirements
  const posts = filterPublishedPosts({ posts: data, includePages })

  // Sort by date
  if (BLOG.sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }


  return posts
}
