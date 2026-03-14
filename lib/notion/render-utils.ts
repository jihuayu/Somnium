interface NotionRichTextItem {
  plain_text?: string | null
}

interface NotionFilePayloadValue {
  url?: string | null
}

interface NotionFilePayload {
  type?: string
  external?: NotionFilePayloadValue | null
  file?: NotionFilePayloadValue | null
}

interface NotionLinkToPage {
  type?: string
}

export function escapeHtml(input: string): string {
  return `${input || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getPlainTextFromRichText(richText: NotionRichTextItem[] = [], trim = false): string {
  const text = richText.map(item => item?.plain_text || '').join('')
  return trim ? text.trim() : text
}

export function getFileBlockUrl(filePayload: NotionFilePayload | null | undefined): string {
  if (!filePayload || typeof filePayload !== 'object') return ''
  if (filePayload.type === 'external') return filePayload?.external?.url || ''
  if (filePayload.type === 'file') return filePayload?.file?.url || ''
  return filePayload?.external?.url || filePayload?.file?.url || ''
}

export function getLinkToPageLabel(linkToPage: NotionLinkToPage | null | undefined): string {
  if (!linkToPage || typeof linkToPage !== 'object') return 'Linked page'
  const linkType = `${linkToPage.type || ''}`
  switch (linkType) {
    case 'page_id':
      return 'Linked page'
    case 'database_id':
      return 'Linked database'
    case 'block_id':
      return 'Linked block'
    case 'comment_id':
      return 'Linked comment'
    default:
      return 'Linked page'
  }
}
