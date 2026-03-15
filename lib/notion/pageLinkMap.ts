import type { PostData } from './filterPublishedPosts'
import {
  buildInternalSlugHref as buildInternalSlugHrefBase,
  buildNotionPublicUrl as buildNotionPublicUrlBase,
  buildPageHrefMap as buildPageHrefMapBase,
  normalizeNotionEntityId as normalizeNotionEntityIdBase,
  resolvePageHref as resolvePageHrefBase,
  type PageHrefEntry,
  type PageHrefMap
} from '@jihuayu/notion-type'

export type PageLinkMap = PageHrefMap

export const normalizeNotionEntityId = normalizeNotionEntityIdBase

export function buildInternalSlugHref(basePath: string, slug: string): string {
  return buildInternalSlugHrefBase(basePath, slug)
}

export function buildPageLinkMap(posts: PostData[], basePath = ''): PageLinkMap {
  const entries: PageHrefEntry[] = (posts || []).map(post => ({
    id: post?.id,
    slug: post?.slug
  }))
  return buildPageHrefMapBase(entries, basePath)
}

export function buildNotionPublicUrl(rawId: string): string {
  return buildNotionPublicUrlBase(rawId)
}

export function resolvePageHref(rawId: string, pageLinkMap: PageLinkMap): string {
  return resolvePageHrefBase(rawId, pageLinkMap)
}
