import type { LinkPreviewData } from '@/lib/link-preview/types'
import type { PostData } from './filterPublishedPosts'
import type { PageLinkMap } from './pageLinkMap'
import { resolvePageHref } from './pageLinkMap'

export type PagePreviewMap = Record<string, LinkPreviewData>

interface BuildPagePreviewMapOptions {
  siteUrl: string
  buildImageUrl?: (pageId: string) => string
}

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
  posts: PostData[],
  pageLinkMap: PageLinkMap,
  { siteUrl, buildImageUrl = () => '' }: BuildPagePreviewMapOptions
): PagePreviewMap {
  const hostname = getSiteHostname(siteUrl)
  const previewMap: PagePreviewMap = {}

  for (const post of posts || []) {
    const id = `${post?.id || ''}`.trim()
    if (!id) continue

    previewMap[id] = {
      url: resolvePageHref(id, pageLinkMap),
      hostname,
      title: `${post?.title || ''}`.trim(),
      description: `${post?.summary || ''}`.trim(),
      image: buildImageUrl(id),
      icon: '/favicon.png'
    }
  }

  return previewMap
}