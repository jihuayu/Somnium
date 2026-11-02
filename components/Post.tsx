import Link from 'next/link'
import cn from 'classnames'
import {
  ARTICLE_CONTENT_MAX_WIDTH_CLASS,
  ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS
} from '@/consts'
import { config } from '@/lib/server/config'
import { formatDate } from '@/lib/formatDate'
import TagItem from '@/components/TagItem'
import NotionRenderer from '@/components/NotionRenderer'
import TableOfContents from '@/components/TableOfContents'
import type { NotionDocument, PagePreviewMap } from '@jihuayu/notion-type'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import type { LinkPreviewMap } from '@/lib/link-preview/types'
import type { PageLinkMap } from '@/lib/notion/pageLinkMap'
import { shouldShowTableOfContents, type RelatedPostLink } from '@/lib/postNavigation'

interface PostProps {
  post: PostData
  document: NotionDocument
  fullWidth?: boolean
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageLinkMap
  pagePreviewMap?: PagePreviewMap
  relatedPosts?: RelatedPostLink[]
}

export function getPostFormatClassNames(post: Pick<PostData, 'formats'>): string[] {
  const formats = new Set(post.formats || [])
  return [
    formats.has('wide') ? 'notion-post-format-wide' : '',
    formats.has('codeHeavy') ? 'notion-post-format-code-heavy' : ''
  ].filter(Boolean)
}

export default function Post(props: PostProps) {
  const { post, document, fullWidth = false, linkPreviewMap = {}, pageLinkMap = {}, pagePreviewMap = {}, relatedPosts = [] } = props
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS
  const isPage = post.type[0] === 'Page'
  const hasTitle = typeof post.title === 'string' && post.title.trim().length > 0

  const toc = document.toc || []
  const showToc = shouldShowTableOfContents(toc, config.tocOverrides?.[post.slug])

  return (
    <article className={cn('reading-post', contentWidthClass, getPostFormatClassNames(post))}>
      {hasTitle && <h1 className="article-title font-sans">{post.title}</h1>}
      {!isPage && (
        <p className="article-meta">
          <Link href="/about">{config.author}</Link>
          <span aria-hidden="true"> · </span>
          <time>{formatDate(post.date, config.lang, config.timezone)}</time>
        </p>
      )}
      <div className="reading-body">
        {showToc && (
          <>
            <details className="inline-toc">
              <summary>目录</summary>
              <TableOfContents toc={toc} />
            </details>
            <aside className="side-toc">
              <div><p>目录</p><TableOfContents toc={toc} /></div>
            </aside>
          </>
        )}
        <NotionRenderer document={document} linkPreviewMap={linkPreviewMap} pageLinkMap={pageLinkMap} pagePreviewMap={pagePreviewMap} />
      </div>
      {!isPage && (!!post.tags?.length || !!relatedPosts.length) && (
        <footer className="article-end">
          {!!relatedPosts.length && (
            <nav aria-label="后续阅读" className="related-posts">
              <ul>
                {relatedPosts.map(link => (
                  <li key={link.href}><Link href={link.href} title={link.title}>{link.label}</Link></li>
                ))}
              </ul>
            </nav>
          )}
          {!!post.tags?.length && (
            <nav aria-label="文章标签" className="article-tags flex flex-wrap gap-2">
              {post.tags.map(tag => <TagItem key={tag} tag={tag} />)}
            </nav>
          )}
        </footer>
      )}
    </article>
  )
}
