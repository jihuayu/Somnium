function normalizeSingleSelect(value) {
  if (Array.isArray(value)) return value[0]
  if (typeof value === 'string') return value
  return null
}

export default function filterPublishedPosts ({ posts, includePages }) {
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
