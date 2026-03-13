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
    <a href={`${blogPath}/${post.slug}`}>
      <article key={post.id} className="mb-6 md:mb-8">
        <header className="flex flex-col justify-between md:flex-row md:items-baseline">
          <h2 className="text-lg md:text-xl font-medium mb-2 cursor-pointer text-black dark:text-gray-100">
            {post.title}
          </h2>
          <time className="flex-shrink-0 text-gray-600 dark:text-gray-400">
            {formatDate(post.date, lang, timezone)}
          </time>
        </header>
        <main>
          <p className="hidden md:block leading-8 text-gray-700 dark:text-gray-300">
            {post.summary}
          </p>
        </main>
      </article>
    </a>
  )
}

export default BlogPost
