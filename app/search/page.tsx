import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import SearchLayout from '@/layouts/search'

export const revalidate = 1

export default async function SearchPage() {
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)

  return <SearchLayout tags={tags} posts={posts} />
}
