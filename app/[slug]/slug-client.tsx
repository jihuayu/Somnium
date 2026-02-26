import cn from 'classnames'
import Link from 'next/link'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import Post from '@/components/Post'
import Comments from '@/components/Comments'
import { config } from '@/lib/server/config'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'
import type { LinkPreviewMap } from '@/lib/link-preview/types'

interface SlugPostClientProps {
  post: PostData
  document: NotionDocument
  fullWidth: boolean
  homePath: string
  backLabel: string
  topLabel: string
  linkPreviewMap?: LinkPreviewMap
}

export default function SlugPostClient({
  post,
  document,
  fullWidth,
  homePath,
  backLabel,
  topLabel,
  linkPreviewMap = {}
}: SlugPostClientProps) {
  return (
    <>
      <Post
        post={post}
        document={document}
        fullWidth={fullWidth}
        linkPreviewMap={linkPreviewMap}
      />

      <div
        className={cn(
          'px-4 flex justify-between font-medium text-gray-500 dark:text-gray-400 my-5',
          fullWidth ? 'md:px-24' : `mx-auto ${ARTICLE_CONTENT_MAX_WIDTH_CLASS}`
        )}
      >
        <Link href={homePath || '/'} className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100">
          ← {backLabel}
        </Link>
        <a href="#top" className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100">
          ↑ {topLabel}
        </a>
      </div>

      <Comments
        frontMatter={post}
        comment={config.comment}
        appearance={config.appearance}
      />
    </>
  )
}
