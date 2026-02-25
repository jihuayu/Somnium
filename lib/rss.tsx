import { Feed } from 'feed'
import { clientConfig, config } from '@/lib/server/config'
import { getPostBlocks } from '@/lib/notion'
import { ConfigProvider } from '@/lib/config'
import NotionRenderer from '@/components/NotionRenderer'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

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

const createFeedContent = async (post: PostData): Promise<string> => {
  const { renderToString } = await (import('react-dom/server') as any)
  const document = await getPostBlocks(post.id)
  const content = renderToString(
    <ConfigProvider value={clientConfig}>
      <NotionRenderer document={document} />
    </ConfigProvider>
  )
  return content
}

export async function generateRss(posts: PostData[], siteOrigin?: string): Promise<string> {
  const year = new Date().getFullYear()
  const siteUrl = resolveSiteUrl(siteOrigin)
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: siteUrl,
    link: siteUrl,
    language: config.lang,
    favicon: buildUrl(siteUrl, 'favicon.svg'),
    copyright: `All rights reserved ${year}, ${config.author}`,
    author: {
      name: config.author,
      email: config.email,
      link: siteUrl
    }
  })

  for (const post of posts) {
    const postUrl = buildUrl(siteUrl, post.slug)
    let content = `<p>${post.summary || ''}</p>`
    try {
      content = await createFeedContent(post)
    } catch (error) {
      console.error(`[feed] Failed to render post content for ${post.slug}:`, error)
    }

    feed.addItem({
      title: post.title,
      id: postUrl,
      link: postUrl,
      description: post.summary,
      content,
      date: new Date(post.date)
    })
  }

  return feed.atom1()
}
