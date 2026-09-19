import cn from 'classnames'
import {
  ARTICLE_CONTENT_MAX_WIDTH_CLASS,
  ARTICLE_TOC_LEFT,
  ARTICLE_TOC_MAX_HEIGHT,
  ARTICLE_TOC_TOP_PX,
  ARTICLE_TOC_WIDTH_PX,
  ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS
} from '@/consts'
import { config } from '@/lib/server/config'
import { formatDate } from '@/lib/formatDate'
import TagItem from '@/components/TagItem'
import NotionRenderer from '@/components/NotionRenderer'
import TableOfContents from '@/components/TableOfContents'
import WideTableOfContents from '@/components/WideTableOfContents'
import type { NotionDocument, PagePreviewMap } from '@jihuayu/notion-type'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { LinkPreviewMap } from '@/lib/link-preview/types'
import type { PageLinkMap } from '@/lib/notion/pageLinkMap'

interface PostProps {
  post: PostData
  document: NotionDocument
  fullWidth?: boolean
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageLinkMap
  pagePreviewMap?: PagePreviewMap
  tocLabel?: string
  tocCloseLabel?: string
}

export function getPostFormatClassNames(post: Pick<PostData, 'formats'>): string[] {
  const formats = new Set(post.formats || [])
  return [
    formats.has('wide') ? 'notion-post-format-wide' : '',
    formats.has('codeHeavy') ? 'notion-post-format-code-heavy' : ''
  ].filter(Boolean)
}

export default function Post(props: PostProps) {
  const {
    post,
    document,
    fullWidth = false,
    linkPreviewMap = {},
    pageLinkMap = {},
    pagePreviewMap = {},
    tocLabel,
    tocCloseLabel
  } = props
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS

  return (
    <article id="post-article" className={cn('flex flex-col items-center', getPostFormatClassNames(post))}>
      <h1 className={cn(
        'w-full font-serif font-semibold text-[2.35rem] md:text-[2.6rem] leading-[1.18] text-stone-900 dark:text-stone-100',
        contentWidthClass,
        'px-4'
      )}>
        {post.title}
      </h1>
      {post.type[0] !== 'Page' && (
        <nav className={cn(
          'w-full flex flex-wrap items-baseline mt-6 mb-4 text-sm text-stone-400 dark:text-stone-500',
          contentWidthClass,
          'px-4'
        )}>
          <a
            href={config.socialLink || '#'}
            className="hover:text-stone-700 dark:hover:text-stone-300 transition-colors duration-150 ease-out"
          >
            {config.author}
          </a>
          <span aria-hidden="true">&nbsp;/&nbsp;</span>
          <time>{formatDate(post.date, config.lang, config.timezone)}</time>
          {(post.tags || []).map(tag => (
            <span key={tag}>
              <span aria-hidden="true">&nbsp;/&nbsp;</span>
              <TagItem tag={tag} />
            </span>
          ))}
        </nav>
      )}
      <div className="self-stretch -mt-4 relative">
        <div className={`mx-auto w-full ${contentWidthClass} px-4`}>
          <NotionRenderer document={document} linkPreviewMap={linkPreviewMap} pageLinkMap={pageLinkMap} pagePreviewMap={pagePreviewMap} />
        </div>
        {!fullWidth && (
          <div
            className="hidden xl:block absolute top-0 bottom-0"
            style={{
              left: ARTICLE_TOC_LEFT,
              width: `${ARTICLE_TOC_WIDTH_PX}px`
            }}
          >
            <TableOfContents
              toc={document?.toc || []}
              label={tocLabel}
              className="sticky pt-3 overflow-y-auto"
              style={{ top: `${ARTICLE_TOC_TOP_PX}px`, maxHeight: `min(${ARTICLE_TOC_MAX_HEIGHT}, 100%)` }}
            />
          </div>
        )}
        {fullWidth && (
          <WideTableOfContents
            toc={document?.toc || []}
            openLabel={tocLabel}
            closeLabel={tocCloseLabel}
          />
        )}
      </div>
    </article>
  )
}
