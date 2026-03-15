import { buildNotionPublicUrl } from '@jihuayu/notion-type'
import type { PageHrefMap, PagePreviewMap } from '@jihuayu/notion-type'
import { buildPagePathFromPage, getPropertyByName } from './properties'
import { getPlainTextFromDirectoryRichText, unique } from './shared'
import type {
  BuildPagePreviewMapOptions,
  NotionPageLike,
  NotionPagePreviewSource,
  NotionProperties,
  PageOgData
} from './types'

function getSiteHostname(siteUrl: string): string {
  const raw = `${siteUrl || ''}`.trim()
  if (!raw) return ''

  try {
    return new URL(raw).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function buildPagePreviewMap(
  items: NotionPagePreviewSource[],
  pageHrefMap: PageHrefMap,
  { siteUrl, buildImageUrl = () => '' }: BuildPagePreviewMapOptions
): PagePreviewMap {
  const hostname = getSiteHostname(siteUrl)
  const previewMap: PagePreviewMap = {}

  for (const item of items || []) {
    const id = `${item?.id || ''}`.trim()
    if (!id) continue
    previewMap[id] = {
      url: pageHrefMap[id] || buildNotionPublicUrl(id),
      hostname,
      title: `${item?.title || ''}`.trim(),
      description: `${item?.summary || ''}`.trim(),
      image: buildImageUrl(id),
      icon: '/favicon.png'
    }
  }

  return previewMap
}

export function getPageTitle(properties: NotionProperties): string {
  const titleProperty = getPropertyByName(properties, 'title')
  if (titleProperty?.type === 'title') {
    return getPlainTextFromDirectoryRichText(titleProperty.title || [])
  }

  for (const property of Object.values(properties)) {
    if (property?.type === 'title') {
      return getPlainTextFromDirectoryRichText(property.title || [])
    }
  }

  return ''
}

export function getRichTextPropertyValue(properties: NotionProperties, fieldName: string): string {
  const property = getPropertyByName(properties, fieldName)
  if (property?.type !== 'rich_text') return ''
  return getPlainTextFromDirectoryRichText(property.rich_text || [])
}

function getMultiSelectPropertyValue(page: NotionPageLike): string[] {
  const property = getPropertyByName(page.properties || {}, 'tags')
  if (!property || property.type !== 'multi_select') return []
  return unique((property.multi_select || []).map(item => `${item?.name || ''}`.trim()))
}

function getPageIcon(page: NotionPageLike): string {
  const icon = page.icon
  if (!icon || typeof icon !== 'object') return ''
  if (icon.type === 'emoji') return `${icon.emoji || ''}`.trim()
  if (icon.type === 'external') return `${icon.external?.url || ''}`.trim()
  if (icon.type === 'file') return `${icon.file?.url || ''}`.trim()
  return ''
}

export function deriveDefaultPageMetadata(page: NotionPageLike) {
  const title = getPageTitle(page.properties || {})
  const summary = getRichTextPropertyValue(page.properties || {}, 'summary')
  const slug = getPlainTextFromDirectoryRichText(getPropertyByName(page.properties || {}, 'slug')?.rich_text || [])
  const tags = getMultiSelectPropertyValue(page)
  const url = buildPagePathFromPage(page) || `${page.url || ''}`.trim() || buildNotionPublicUrl(page.id)
  const icon = getPageIcon(page)
  return {
    id: `${page.id || ''}`.trim(),
    title,
    summary,
    tags,
    slug,
    url,
    icon
  }
}

export function mapPageToOgData(page: NotionPageLike): PageOgData {
  const cover = page.cover
  let coverUrl = ''
  let coverType: 'external' | 'file' | null = null

  if (cover?.type === 'external') {
    coverUrl = `${cover.external?.url || ''}`.trim()
    coverType = coverUrl ? 'external' : null
  } else if (cover?.type === 'file') {
    coverUrl = `${cover.file?.url || ''}`.trim()
    coverType = coverUrl ? 'file' : null
  }

  return {
    id: `${page.id || ''}`.trim(),
    title: getPageTitle(page.properties || {}),
    summary: getRichTextPropertyValue(page.properties || {}, 'summary'),
    coverUrl,
    coverType
  }
}
