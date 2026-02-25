export interface PostData {
  id: string
  title: string
  slug: string
  summary: string
  tags: string[]
  type: string[]
  status: string[]
  fullWidth: boolean
  date: number
}

function normalizeSingleSelect(value: unknown): string | null {
  if (Array.isArray(value)) return value[0] as string
  if (typeof value === 'string') return value
  return null
}

export default function filterPublishedPosts({ posts, includePages }: {
  posts: PostData[]
  includePages: boolean
}): PostData[] {
  if (!posts || !posts.length) return []
  return posts
    .filter(post => {
      const postType = normalizeSingleSelect(post?.type)
      return includePages
        ? postType === 'Post' || postType === 'Page'
        : postType === 'Post'
    })
    .filter(post => {
      const status = normalizeSingleSelect(post?.status)
      return (
        post.title &&
        post.slug &&
        status === 'Published' &&
        Number(post.date) <= Date.now()
      )
    })
}
