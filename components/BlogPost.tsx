import Link from 'next/link'
import { formatDate } from '@/lib/formatDate'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface BlogPostProps {
  post: PostData
  blogPath: string
  lang: string
  timezone?: string
}

const BlogPost = ({ post, blogPath, lang, timezone }: BlogPostProps) => {
  return (
    <article className="post-entry">
      <header className="entry-heading">
        <h2 className="font-sans"><Link href={`${blogPath}/${post.slug}`} prefetch={false}>{post.title}</Link></h2>
        <time>{formatDate(post.date, lang, timezone)}</time>
      </header>
      {post.summary && <p className="entry-summary">{post.summary}</p>}
    </article>
  )
}

export default BlogPost
