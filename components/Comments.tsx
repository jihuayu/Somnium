import cn from 'classnames'
import { CommentBox, type CommentBoxLabels } from '@jihuayu/somnium-comments'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS, ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { config } from '@/lib/server/config'
import type { BlogConfig } from '@/lib/config'
import type { PostData } from '@/lib/notion/filterPublishedPosts'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'

interface CommentsProps {
  frontMatter: PostData
  comment: BlogConfig['comment']
  compact?: boolean
  labels?: CommentBoxLabels
}

function buildCommentPageUrl(slug: string): string | undefined {
  const siteUrl = `${config.link || ''}`.trim()
  if (!siteUrl) return undefined

  try {
    return new URL(buildInternalSlugHref(config.path || '', slug), siteUrl).toString()
  } catch {
    return undefined
  }
}

const Comments = ({ frontMatter, comment, compact = false, labels }: CommentsProps) => {
  const fullWidth = frontMatter.fullWidth ?? false
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS
  const atriumConfig = comment?.atriumConfig
  const commentPageUrl = buildCommentPageUrl(frontMatter.slug)

  if (!comment || comment.provider !== 'atrium') return null

  return (
    <CommentBox
      key={frontMatter.id}
      websiteKey={atriumConfig?.websiteKey}
      pageKey={frontMatter.id}
      endpoint={atriumConfig?.endpoint}
      pageTitle={frontMatter.title}
      pageUrl={commentPageUrl}
      locale={config.lang}
      labels={labels}
      className={cn(
        !compact && 'px-4',
        !compact && `mx-auto ${contentWidthClass}`
      )}
    />
  )
}

export default Comments
