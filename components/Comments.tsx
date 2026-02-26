import cn from 'classnames'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import Utterances from '@/components/Utterances'
import type { BlogConfig } from '@/lib/config'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface CommentsProps {
  frontMatter: PostData
  comment: BlogConfig['comment']
  appearance: BlogConfig['appearance']
}

const Comments = ({ frontMatter, comment, appearance }: CommentsProps) => {
  const fullWidth = frontMatter.fullWidth ?? false
  const utterancesRepo = comment?.utterancesConfig?.repo

  if (!comment || comment.provider !== 'utterances' || !utterancesRepo) return null

  return (
    <section
      className={cn(
        'px-4 font-medium text-gray-500 dark:text-gray-400 my-5',
        fullWidth ? 'md:px-24' : `mx-auto ${ARTICLE_CONTENT_MAX_WIDTH_CLASS}`
      )}
    >
      <Utterances issueTerm={frontMatter.id} repo={utterancesRepo} appearance={appearance} />
    </section>
  )
}

export default Comments
