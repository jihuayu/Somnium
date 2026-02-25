import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import SearchLayout from '@/layouts/search'

export const revalidate = 1

export default async function SearchPage() {
  const allPosts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(allPosts)

  return <SearchLayout tags={tags} posts={[]} useNotionSearch />
}
