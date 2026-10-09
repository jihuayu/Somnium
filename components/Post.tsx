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
}

export function getPostFormatClassNames(post: Pick<PostData, 'formats'>): string[] {
  const formats = new Set(post.formats || [])
  return [
    formats.has('wide') ? 'notion-post-format-wide' : '',
    formats.has('codeHeavy') ? 'notion-post-format-code-heavy' : ''
  ].filter(Boolean)
}

export default function Post(props: PostProps) {
  const { post, document, fullWidth = false, linkPreviewMap = {}, pageLinkMap = {}, pagePreviewMap = {} } = props
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS
  const isPage = post.type[0] === 'Page'
  const hasTitle = typeof post.title === 'string' && post.title.trim().length > 0

  return (
    <article className={cn('flex flex-col items-center', getPostFormatClassNames(post))}>
      {hasTitle && (
        <h1 className={cn(
          'w-full font-serif font-semibold text-[2rem] leading-tight tracking-[-0.025em] text-stone-900 dark:text-stone-100',
          contentWidthClass,
          'px-4'
        )}>
          {post.title}
        </h1>
      )}
      {!isPage && (
        <nav className={cn(
          'w-full flex mt-6 items-start text-sm text-stone-400 dark:text-stone-500',
          contentWidthClass,
          'px-4'
        )}>
          <div className="flex mb-4">
            <a href={config.socialLink || '#'} className="flex hover:text-stone-700 dark:hover:text-stone-300 transition-colors duration-150 ease-out">
              <p className="ml-2 md:block">{config.author}</p>
            </a>
            <span className="block">&nbsp;/&nbsp;</span>
          </div>
          <div className="mr-2 mb-4 md:ml-0">
            {formatDate(post.date, config.lang, config.timezone)}
          </div>
          {post.tags && (
            <div className="flex flex-nowrap max-w-full overflow-x-auto article-tags">
              {post.tags.map(tag => (
                <TagItem key={tag} tag={tag} />
              ))}
            </div>
          )}
        </nav>
      )}
      <div className={cn('self-stretch relative', isPage ? hasTitle && 'mt-4 md:mt-6' : '-mt-4')}>
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
              className="sticky pt-3 overflow-y-auto"
              style={{ top: `${ARTICLE_TOC_TOP_PX}px`, maxHeight: `min(${ARTICLE_TOC_MAX_HEIGHT}, 100%)` }}
            />
          </div>
        )}
        {fullWidth && <WideTableOfContents toc={document?.toc || []} />}
      </div>
    </article>
  )
}
