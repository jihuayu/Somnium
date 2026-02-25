import { resolveEmbedIframeUrl } from '@/lib/notion/embed'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'

export function getLinkPreviewTargets(document: NotionDocument | null): string[] {
  if (!document) return []

  const urls = new Set<string>()
  const blocks = Object.values(document.blocksById || {})

  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue

    if (block.type === 'bookmark') {
      const url = block?.bookmark?.url
      if (typeof url === 'string' && url) urls.add(url)
      continue
    }

    if (block.type === 'embed') {
      const url = block?.embed?.url
      if (typeof url !== 'string' || !url) continue
      if (resolveEmbedIframeUrl(url)) continue
      urls.add(url)
    }
  }

  return Array.from(urls)
}
