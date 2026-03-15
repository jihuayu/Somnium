import { unstable_cache } from 'next/cache'
import { config } from '@/lib/server/config'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import { getAllPosts } from '@/lib/notion/getAllPosts'
import { buildNotionDocument } from '@/lib/notion/getPostBlocks'
import { buildPageLinkMap, type PageLinkMap } from '@/lib/notion/pageLinkMap'
import { generateRssFeed, renderNotionDocumentToHtml } from '@jihuayu/notion-type/rss'
import { mapWithConcurrency } from '@/lib/utils/promisePool'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

const FEED_POST_BLOCKS_CACHE_SECONDS = ONE_DAY_SECONDS
const FEED_RENDER_CONCURRENCY = 4

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function resolveSiteUrl(siteOrigin?: string): string {
  const input = (siteOrigin || config.link || '').trim()
  const fallback = 'https://example.com'
  const normalized = input || fallback

  try {
    const url = new URL(normalized)
    const root = url.origin.replace(/\/+$/g, '')
    const basePath = trimSlashes(config.path || '')
    return basePath ? `${root}/${basePath}` : root
  } catch {
    return fallback
  }
}

function buildUrl(baseUrl: string, path?: string): string {
  const root = baseUrl.replace(/\/+$/g, '')
  const suffix = trimSlashes(path || '')
  return suffix ? `${root}/${suffix}` : root
}

const getCachedFeedDocument = unstable_cache(
  async (postId: string) => buildNotionDocument(postId, { includeToc: false }),
  ['feed-post-blocks-v3'],
  { revalidate: FEED_POST_BLOCKS_CACHE_SECONDS, tags: ['feed-post-blocks'] }
)

const getCachedFeedPageLinkMap = unstable_cache(
  async () => {
    const allPosts = await getAllPosts({ includePages: true })
    return buildPageLinkMap(allPosts, config.path || '')
  },
  ['feed-page-link-map-v1'],
  { revalidate: FEED_POST_BLOCKS_CACHE_SECONDS, tags: ['feed-post-blocks', 'page-link-map'] }
)

interface FeedContentPayload {
  html: string
}

function fallbackFeedContent(post: PostData): FeedContentPayload {
  const summary = (post.summary || '').trim()
  return {
    html: `<p>${summary.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`
  }
}

const createFeedContent = async (post: PostData, pageLinkMap: PageLinkMap): Promise<FeedContentPayload> => {
  const document = await getCachedFeedDocument(post.id)
  if (!document) return fallbackFeedContent(post)

  const html = renderNotionDocumentToHtml(document, { pageHrefMap: pageLinkMap })
  const fallback = fallbackFeedContent(post)

  return {
    html: html || fallback.html
  }
}

export async function generateRss(posts: PostData[], siteOrigin?: string): Promise<string> {
  const { Feed } = await import('feed')
  const year = new Date().getFullYear()
  const siteUrl = resolveSiteUrl(siteOrigin)
  const pageLinkMap = await getCachedFeedPageLinkMap()
  const items = await mapWithConcurrency(posts, FEED_RENDER_CONCURRENCY, async (post) => {
    const postUrl = buildUrl(siteUrl, post.slug)
    let content = fallbackFeedContent(post)

    try {
      content = await createFeedContent(post, pageLinkMap)
    } catch (error) {
      console.error(`[feed] Failed to render post content for ${post.slug}:`, error)
    }

    return {
      title: post.title,
      id: postUrl,
      link: postUrl,
      description: (post.summary || '').trim(),
      content: content.html,
      date: new Date(post.date),
      author: [{
        name: config.author,
        email: config.email,
        link: siteUrl
      }]
    }
  })

  return generateRssFeed({
    title: config.title,
    description: config.description,
    siteUrl,
    language: config.lang,
    favicon: buildUrl(siteUrl, 'favicon.svg'),
    copyright: `All rights reserved ${year}, ${config.author}`,
    author: {
      name: config.author,
      email: config.email,
      link: siteUrl
    },
    items: items.map(item => ({
      title: item.title,
      id: item.id,
      link: item.link,
      description: item.description,
      contentHtml: item.content,
      date: item.date,
      author: item.author
    }))
  })
}
