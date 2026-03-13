import type { LinkPreviewData } from '@/lib/link-preview/types'
import type { PostData } from './filterPublishedPosts'
import type { PageLinkMap } from './pageLinkMap'
import { resolvePageHref } from './pageLinkMap'
import { buildNotionOgImageUrl } from '@/lib/server/metadata'
import { config } from '@/lib/server/config'

export type PagePreviewMap = Record<string, LinkPreviewData>

function getSiteHostname(): string {
  const raw = `${config.link || ''}`.trim()
  if (!raw) return ''

  try {
    return new URL(raw).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export function buildPagePreviewMap(posts: PostData[], pageLinkMap: PageLinkMap): PagePreviewMap {
  const hostname = getSiteHostname()
  const previewMap: PagePreviewMap = {}

  for (const post of posts || []) {
    const id = `${post?.id || ''}`.trim()
    if (!id) continue

    previewMap[id] = {
      url: resolvePageHref(id, pageLinkMap),
      hostname,
      title: `${post?.title || ''}`.trim(),
      description: `${post?.summary || ''}`.trim(),
      image: buildNotionOgImageUrl(id),
      icon: '/favicon.png'
    }
  }

  return previewMap
}