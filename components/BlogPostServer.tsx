import { config } from '@/lib/server/config'
import BlogPost from '@/components/BlogPost'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface BlogPostServerProps {
  post: PostData
}

export default function BlogPostServer({ post }: BlogPostServerProps) {
  return (
    <BlogPost
      post={post}
      blogPath={config.path || ''}
      lang={config.lang}
      timezone={config.timezone}
    />
  )
}
