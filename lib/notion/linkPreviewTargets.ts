import { resolveEmbedIframeUrl } from '@/lib/notion/embed'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'

function addUrl(urls: Set<string>, value: unknown) {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (!trimmed) return
  urls.add(trimmed)
}

function collectRichTextMentionUrls(urls: Set<string>, richText: any[] = []) {
  for (const item of richText) {
    if (!item || typeof item !== 'object' || item.type !== 'mention') continue

    if (item?.mention?.type === 'link_preview') {
      addUrl(urls, item?.mention?.link_preview?.url)
      continue
    }

    if (item?.mention?.type === 'link_mention') {
      addUrl(urls, item?.mention?.link_mention?.href)
    }
  }
}

export function getLinkPreviewTargets(document: NotionDocument | null): string[] {
  if (!document) return []

  const urls = new Set<string>()
  const blocks = Object.values(document.blocksById || {})

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue

    if (block.type === 'bookmark') {
      addUrl(urls, block?.bookmark?.url)
    }

    if (block.type === 'link_preview') {
      addUrl(urls, block?.link_preview?.url)
    }

    if (block.type === 'embed') {
      const url = block?.embed?.url
      if (typeof url !== 'string' || !url) continue
      if (resolveEmbedIframeUrl(url)) continue
      addUrl(urls, url)
    }

    const payload = block[block.type]
    if (!payload || typeof payload !== 'object') continue

    if (Array.isArray(payload.rich_text)) {
      collectRichTextMentionUrls(urls, payload.rich_text)
    }

    if (block.type === 'table_row') {
      const cells = payload.cells
      if (!Array.isArray(cells)) continue
      for (const cell of cells) {
        if (!Array.isArray(cell)) continue
        collectRichTextMentionUrls(urls, cell)
      }
    }
  }

  return Array.from(urls)
}
