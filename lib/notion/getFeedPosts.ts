import { getAllPosts } from './getAllPosts'
import type { PostData } from './filterPublishedPosts'

export async function getFeedPosts(): Promise<PostData[]> {
  return getAllPosts({ includePages: false })
}
