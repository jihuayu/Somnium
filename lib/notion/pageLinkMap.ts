import type { PostData } from './filterPublishedPosts'

export type PageLinkMap = Record<string, string>

function trimSlashes(value: string): string {
  return `${value || ''}`.trim().replace(/^\/+|\/+$/g, '')
}

export function normalizeNotionEntityId(rawId?: string): string {
  const compact = `${rawId || ''}`.trim().replaceAll('-', '').toLowerCase()
  return /^[0-9a-f]{32}$/.test(compact) ? compact : ''
}

export function buildInternalSlugHref(basePath: string, slug: string): string {
  const normalizedBase = trimSlashes(basePath)
  const normalizedSlug = trimSlashes(slug)
  if (!normalizedSlug) return normalizedBase ? `/${normalizedBase}` : '/'
  return normalizedBase ? `/${normalizedBase}/${normalizedSlug}` : `/${normalizedSlug}`
}

export function buildPageLinkMap(posts: PostData[], basePath = ''): PageLinkMap {
  const map: PageLinkMap = {}
  for (const post of posts || []) {
    const key = normalizeNotionEntityId(post?.id)
    const slug = `${post?.slug || ''}`.trim()
    if (!key || !slug) continue
    map[key] = buildInternalSlugHref(basePath, slug)
  }
  return map
}

export function buildNotionPublicUrl(rawId: string): string {
  const normalized = normalizeNotionEntityId(rawId)
  return normalized ? `https://www.notion.so/${normalized}` : ''
}

export function resolvePageHref(rawId: string, pageLinkMap: PageLinkMap): string {
  const normalized = normalizeNotionEntityId(rawId)
  if (!normalized) return ''
  return pageLinkMap[normalized] || buildNotionPublicUrl(normalized)
}
