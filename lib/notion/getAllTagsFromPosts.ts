import type { PostData } from './filterPublishedPosts'

export function getAllTagsFromPosts(posts: PostData[]): Record<string, number> {
  const tagObj: Record<string, number> = {}

  for (const post of posts) {
    const tags = post?.tags || []
    for (const tag of tags) {
      if (tag in tagObj) {
        tagObj[tag] += 1
      } else {
        tagObj[tag] = 1
      }
    }
  }

  return tagObj
}
