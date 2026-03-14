import type { MetadataRoute } from 'next'
import { unstable_cache } from 'next/cache'
import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'
import { ONE_DAY_SECONDS } from './cache'
import { config } from './config'

type SitemapEntry = MetadataRoute.Sitemap[number]

interface BuildSitemapEntriesInput {
  siteOrigin: string
  basePath: string
  allPosts: PostData[]
  publishedPosts: PostData[]
  postsPerPage: number
}

function trimSlashes(value: string): string {
  return `${value || ''}`.trim().replace(/^\/+|\/+$/g, '')
}

export function buildSiteOrigin(rawUrl: string): string {
  const fallback = 'https://example.com'
  const source = `${rawUrl || ''}`.trim() || fallback

  try {
    return new URL(source).origin.replace(/\/+$/g, '')
  } catch {
    return fallback
  }
}

export function buildSiteRelativePath(basePath: string, rawPath = '/'): string {
  const normalizedBasePath = trimSlashes(basePath)
  const normalizedPath = `${rawPath || '/'}`.trim()

  if (!normalizedPath || normalizedPath === '/') {
    return normalizedBasePath ? `/${normalizedBasePath}` : '/'
  }

  const strippedPath = normalizedPath.replace(/^\/+/g, '')
  return normalizedBasePath
    ? `/${normalizedBasePath}/${strippedPath}`
    : `/${strippedPath}`
}

export function buildSiteAbsoluteUrl(siteOrigin: string, relativePath: string): string {
  const url = new URL(relativePath, `${siteOrigin}/`)
  if (url.pathname === '/' && !url.search && !url.hash) {
    return siteOrigin
  }
  return url.toString()
}

function resolveLastModifiedFromPosts(posts: PostData[], fallback: Date): Date {
  let latestTimestamp = 0

  for (const post of posts) {
    const timestamp = Number(post?.date || 0)
    if (Number.isFinite(timestamp) && timestamp > latestTimestamp) {
      latestTimestamp = timestamp
    }
  }

  if (!latestTimestamp) return fallback

  const date = new Date(latestTimestamp)
  return Number.isNaN(date.getTime()) ? fallback : date
}

function upsertSitemapEntry(
  entriesByUrl: Map<string, SitemapEntry>,
  entry: SitemapEntry
) {
  const existing = entriesByUrl.get(entry.url)
  if (!existing) {
    entriesByUrl.set(entry.url, entry)
    return
  }

  const existingLastModified = existing.lastModified ? new Date(existing.lastModified) : null
  const nextLastModified = entry.lastModified ? new Date(entry.lastModified) : null

  if (
    nextLastModified &&
    !Number.isNaN(nextLastModified.getTime()) &&
    (
      !existingLastModified ||
      Number.isNaN(existingLastModified.getTime()) ||
      nextLastModified.getTime() > existingLastModified.getTime()
    )
  ) {
    entriesByUrl.set(entry.url, {
      ...existing,
      ...entry,
      lastModified: nextLastModified
    })
  }
}

function createEntry(
  siteOrigin: string,
  relativePath: string,
  lastModified: Date,
  changeFrequency: SitemapEntry['changeFrequency'],
  priority: number
): SitemapEntry {
  return {
    url: buildSiteAbsoluteUrl(siteOrigin, relativePath),
    lastModified,
    changeFrequency,
    priority
  }
}

export function buildSitemapEntries({
  siteOrigin,
  basePath,
  allPosts,
  publishedPosts,
  postsPerPage
}: BuildSitemapEntriesInput): MetadataRoute.Sitemap {
  const entriesByUrl = new Map<string, SitemapEntry>()
  const now = new Date()
  const safePostsPerPage = Math.max(1, Math.floor(postsPerPage) || 1)
  const latestPublishedDate = resolveLastModifiedFromPosts(publishedPosts, now)

  upsertSitemapEntry(
    entriesByUrl,
    createEntry(siteOrigin, buildSiteRelativePath(basePath, '/'), latestPublishedDate, 'daily', 1)
  )
  upsertSitemapEntry(
    entriesByUrl,
    createEntry(siteOrigin, buildSiteRelativePath(basePath, '/search'), latestPublishedDate, 'daily', 0.6)
  )
  upsertSitemapEntry(
    entriesByUrl,
    createEntry(siteOrigin, buildSiteRelativePath(basePath, '/feed'), latestPublishedDate, 'daily', 0.4)
  )

  for (const post of allPosts) {
    const slug = `${post?.slug || ''}`.trim()
    if (!slug) continue

    const lastModified = resolveLastModifiedFromPosts([post], latestPublishedDate)
    upsertSitemapEntry(
      entriesByUrl,
      createEntry(
        siteOrigin,
        buildInternalSlugHref(basePath, slug),
        lastModified,
        'weekly',
        0.8
      )
    )
  }

  const totalPages = Math.ceil(publishedPosts.length / safePostsPerPage)
  for (let page = 2; page <= totalPages; page += 1) {
    const pagePosts = publishedPosts.slice(
      safePostsPerPage * (page - 1),
      safePostsPerPage * page
    )
    const lastModified = resolveLastModifiedFromPosts(pagePosts, latestPublishedDate)
    upsertSitemapEntry(
      entriesByUrl,
      createEntry(
        siteOrigin,
        buildSiteRelativePath(basePath, `/page/${page}`),
        lastModified,
        'daily',
        0.6
      )
    )
  }

  const tags = Object.keys(getAllTagsFromPosts(publishedPosts)).sort((left, right) => left.localeCompare(right))
  for (const tag of tags) {
    const taggedPosts = publishedPosts.filter(post => post.tags?.includes(tag))
    const lastModified = resolveLastModifiedFromPosts(taggedPosts, latestPublishedDate)
    upsertSitemapEntry(
      entriesByUrl,
      createEntry(
        siteOrigin,
        buildSiteRelativePath(basePath, `/tag/${encodeURIComponent(tag)}`),
        lastModified,
        'weekly',
        0.5
      )
    )
  }

  return Array.from(entriesByUrl.values()).sort((left, right) => left.url.localeCompare(right.url))
}

const getCachedSitemapEntries = unstable_cache(
  async () => {
    const [allPosts, publishedPosts] = await Promise.all([
      getAllPosts({ includePages: true }),
      getAllPosts({ includePages: false })
    ])

    return buildSitemapEntries({
      siteOrigin: buildSiteOrigin(config.link || ''),
      basePath: config.path || '',
      allPosts,
      publishedPosts,
      postsPerPage: config.postsPerPage
    })
  },
  ['dynamic-sitemap'],
  {
    revalidate: ONE_DAY_SECONDS,
    tags: ['sitemap', 'notion-posts', 'notion-feed-posts', 'page-link-map']
  }
)

export async function getSitemapEntries(): Promise<MetadataRoute.Sitemap> {
  return getCachedSitemapEntries()
}
