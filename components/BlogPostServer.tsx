import BlogPost from '@/components/BlogPost'
import { config } from '@/lib/server/config'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

export default function BlogPostServer({ post }: { post: PostData }) {
  return <BlogPost post={post} blogPath={config.path || ''} lang={config.lang} timezone={config.timezone} />
}
