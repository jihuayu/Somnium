'use client'

import { useRouter } from 'next/navigation'
import cn from 'classnames'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { useLocale } from '@/lib/locale'
import { useConfig } from '@/lib/config'
import Post from '@/components/Post'
import Comments from '@/components/Comments'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { NotionDocument } from '@/lib/notion/getPostBlocks'
import type { LinkPreviewMap } from '@/lib/link-preview/types'

interface SlugPostClientProps {
  post: PostData
  document: NotionDocument
  fullWidth: boolean
  linkPreviewMap?: LinkPreviewMap
}

export default function SlugPostClient({ post, document, fullWidth, linkPreviewMap = {} }: SlugPostClientProps) {
  const router = useRouter()
  const BLOG = useConfig()
  const locale = useLocale()

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
        <a>
          <button
            onClick={() => router.push(BLOG.path || '/')}
            className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100"
          >
            ← {locale.POST.BACK}
          </button>
        </a>
        <a>
          <button
            onClick={() => window.scrollTo({
              top: 0,
              behavior: 'smooth'
            })}
            className="mt-2 cursor-pointer hover:text-black dark:hover:text-gray-100"
          >
            ↑ {locale.POST.TOP}
          </button>
        </a>
      </div>

      <Comments frontMatter={post} />
    </>
  )
}
