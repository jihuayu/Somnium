import cn from 'classnames'
import Link from 'next/link'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS, ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import Post from '@/components/Post'
import ReadingProgress from '@/components/ReadingProgress'
import type { NotionDocument, PagePreviewMap } from '@jihuayu/notion-type'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { LinkPreviewMap } from '@/lib/link-preview/types'
import type { PageLinkMap } from '@/lib/notion/pageLinkMap'
import type { RelatedPostLink } from '@/lib/postNavigation'

interface SlugPostClientProps {
  post: PostData
  document: NotionDocument
  fullWidth: boolean
  homePath: string
  backLabel: string
  topLabel: string
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageLinkMap
  pagePreviewMap?: PagePreviewMap
  relatedPosts?: RelatedPostLink[]
}

export default function SlugPostClient({
  post,
  document,
  fullWidth,
  homePath,
  backLabel,
  topLabel,
  linkPreviewMap = {},
  pageLinkMap = {},
  pagePreviewMap = {},
  relatedPosts = []
}: SlugPostClientProps) {
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS

  return (
    <>
      <ReadingProgress />
      <Post
        post={post}
        document={document}
        fullWidth={fullWidth}
        linkPreviewMap={linkPreviewMap}
        pageLinkMap={pageLinkMap}
        pagePreviewMap={pagePreviewMap}
        relatedPosts={relatedPosts}
      />

      <div
        className={cn(
          'article-actions px-5 flex justify-between text-sm mb-6',
          `mx-auto ${contentWidthClass}`
        )}
      >
        <Link href={homePath || '/'} className="min-h-11 flex items-center gap-1.5 cursor-pointer hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-150 ease-out">
          <span aria-hidden="true">←</span>
          {backLabel}
        </Link>
        <a href="#top" className="min-h-11 flex items-center gap-1.5 cursor-pointer hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-150 ease-out">
          <span aria-hidden="true">↑</span>
          {topLabel}
        </a>
      </div>
    </>
  )
}
