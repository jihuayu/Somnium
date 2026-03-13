import { getPropertyByName } from './postMapper'

export interface PageOgData {
  id: string
  title: string
  summary: string
  coverUrl: string
  coverType: 'external' | 'file' | null
}

function getPlainTextFromRichText(richText: any[] = []): string {
  return richText.map(item => item?.plain_text || '').join('').trim()
}

function getPageTitle(properties: Record<string, any>): string {
  const titleProperty = getPropertyByName(properties, 'title')
  if (titleProperty?.type === 'title') {
    return getPlainTextFromRichText(titleProperty.title || [])
  }

  for (const property of Object.values(properties)) {
    if (property?.type === 'title') {
      return getPlainTextFromRichText(property.title || [])
    }
  }

  return ''
}

function getRichTextPropertyValue(properties: Record<string, any>, fieldName: string): string {
  const property = getPropertyByName(properties, fieldName)
  if (property?.type !== 'rich_text') return ''
  return getPlainTextFromRichText(property.rich_text || [])
}

function getPageCover(page: any): Pick<PageOgData, 'coverUrl' | 'coverType'> {
  const cover = page?.cover
  if (!cover || typeof cover !== 'object') {
    return { coverUrl: '', coverType: null }
  }

  if (cover.type === 'external') {
    return {
      coverUrl: `${cover?.external?.url || ''}`.trim(),
      coverType: 'external'
    }
  }

  if (cover.type === 'file') {
    return {
      coverUrl: `${cover?.file?.url || ''}`.trim(),
      coverType: 'file'
    }
  }

  return { coverUrl: '', coverType: null }
}

export function mapPageToOgData(page: any): PageOgData {
  const properties = page?.properties || {}
  const { coverUrl, coverType } = getPageCover(page)

  return {
    id: `${page?.id || ''}`.trim(),
    title: getPageTitle(properties),
    summary: getRichTextPropertyValue(properties, 'summary'),
    coverUrl,
    coverType
  }
}
