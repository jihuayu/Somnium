import Link from 'next/link'
import { formatDate } from '@/lib/formatDate'
import TagItem from '@/components/TagItem'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

const MAX_LIST_TAGS = 2

interface BlogPostProps {
  post: PostData
  blogPath: string
  lang: string
  timezone?: string
}

const BlogPost = ({ post, blogPath, lang, timezone }: BlogPostProps) => {
  const href = `${blogPath}/${post.slug}`
  const tags = (post.tags || []).slice(0, MAX_LIST_TAGS)
  const parsedDate = new Date(post.date)
  const dateTime = Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString()

  return (
    <article className="relative mb-10 md:mb-12">
      <header className="flex flex-col justify-between md:flex-row md:items-baseline md:gap-6">
        <h2 className="mb-1.5 font-serif text-lg font-semibold tracking-tight text-stone-900 dark:text-stone-100 md:text-2xl">
          <Link
            href={href}
            prefetch={false}
            className="cursor-pointer underline-offset-[5px] decoration-1 decoration-stone-300 after:absolute after:inset-0 hover:underline dark:decoration-stone-600"
          >
            {post.title}
          </Link>
        </h2>
        <div className="flex shrink-0 items-baseline text-xs text-stone-400 dark:text-stone-500">
          <time dateTime={dateTime} className="tabular-nums">
            {formatDate(post.date, lang, timezone)}
          </time>
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-baseline">
              <span aria-hidden="true">&nbsp;/&nbsp;</span>
              <TagItem tag={tag} className="relative z-10 max-w-[7em] truncate" />
            </span>
          ))}
        </div>
      </header>
      {post.summary && (
        <p className="hidden leading-8 text-stone-600 dark:text-stone-400 md:block">
          {post.summary}
        </p>
      )}
    </article>
  )
}

export default BlogPost
