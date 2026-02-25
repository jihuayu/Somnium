import { getAllPosts, getAllTagsFromPosts } from '@/lib/notion'
import SearchLayout from '@/layouts/search'

export const revalidate = 1

export async function generateStaticParams() {
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  return Object.keys(tags).map(tag => ({ tag }))
}

function decodeRouteTag(tag: string): string {
  let decoded = tag
  for (let i = 0; i < 2; i += 1) {
    try {
      const next = decodeURIComponent(decoded)
      if (next === decoded) break
      decoded = next
    } catch {
      break
    }
  }
  return decoded
}

interface TagPageProps {
  params: Promise<{ tag: string }>
}

export default async function TagPage({ params }: TagPageProps) {
  const { tag } = await params
  const currentTag = decodeRouteTag(tag)
  const posts = await getAllPosts({ includePages: false })
  const tags = getAllTagsFromPosts(posts)
  const filteredPosts = posts.filter(
    post => post && post.tags && post.tags.includes(currentTag)
  )

  return <SearchLayout tags={tags} posts={filteredPosts} currentTag={currentTag} useNotionSearch />
}
