import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import SearchLayout from '@/layouts/search'
import { decodePossiblyEncoded } from '@/lib/url/decodePossiblyEncoded'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'

export const revalidate = ONE_DAY_SECONDS

export async function generateStaticParams() {
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  return Object.keys(tags).map(tag => ({ tag }))
}

interface TagPageProps {
  params: Promise<{ tag: string }>
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params
  const currentTag = decodePossiblyEncoded(tag)
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  const filteredPosts = posts.filter(
    post => post && post.tags && post.tags.includes(currentTag)
  )

  return <SearchLayout tags={tags} posts={filteredPosts} currentTag={currentTag} useNotionSearch />
}
