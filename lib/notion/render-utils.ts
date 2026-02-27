export function escapeHtml(input: string): string {
  return `${input || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function getPlainTextFromRichText(richText: any[] = [], trim = false): string {
  const text = richText.map(item => item?.plain_text || '').join('')
  return trim ? text.trim() : text
}

export function getFileBlockUrl(filePayload: any): string {
  if (!filePayload || typeof filePayload !== 'object') return ''
  if (filePayload.type === 'external') return filePayload?.external?.url || ''
  if (filePayload.type === 'file') return filePayload?.file?.url || ''
  return filePayload?.external?.url || filePayload?.file?.url || ''
}

export function getLinkToPageLabel(linkToPage: any): string {
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
