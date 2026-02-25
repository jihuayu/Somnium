import { Feed } from 'feed'
import { clientConfig, config } from '@/lib/server/config'
import { getPostBlocks } from '@/lib/notion'
import { ConfigProvider } from '@/lib/config'
import NotionRenderer from '@/components/NotionRenderer'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

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

export async function generateRss(posts: PostData[]): Promise<string> {
  const year = new Date().getFullYear()
  const feed = new Feed({
    title: config.title,
    description: config.description,
    id: `${config.link}/${config.path}`,
    link: `${config.link}/${config.path}`,
    language: config.lang,
    favicon: `${config.link}/favicon.svg`,
    copyright: `All rights reserved ${year}, ${config.author}`,
    author: {
      name: config.author,
      email: config.email,
      link: config.link
    }
  })
  for (const post of posts) {
    feed.addItem({
      title: post.title,
      id: `${config.link}/${post.slug}`,
      link: `${config.link}/${post.slug}`,
      description: post.summary,
      content: await createFeedContent(post),
      date: new Date(post.date)
    })
  }
  return feed.atom1()
}
