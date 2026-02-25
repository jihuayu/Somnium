import { config as BLOG } from '@/lib/server/config'
import api from '@/lib/server/notion-api'
import filterPublishedPosts, { PostData } from './filterPublishedPosts'
import { mapPageToPost, normalizeNotionUuid } from './postMapper'

/**
 * @param includePages - false: posts only / true: include pages
 */
export async function getAllPosts({ includePages = false }: { includePages: boolean }): Promise<PostData[]> {
  const dataSourceId = normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
  if (!dataSourceId) {
    throw new Error('Missing required environment variable: NOTION_DATA_SOURCE_ID')
  }

  const pages = await api.queryAllDataSourcePages(dataSourceId)
  const data = pages.map(mapPageToPost).filter(post => post?.id)

  const posts = filterPublishedPosts({ posts: data, includePages })

  if (BLOG.sortByDate) {
    posts.sort((a, b) => b.date - a.date)
  }

  return posts
}
