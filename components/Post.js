import PropTypes from 'prop-types'
import cn from 'classnames'
import { useConfig } from '@/lib/config'
import FormattedDate from '@/components/FormattedDate'
import TagItem from '@/components/TagItem'
import NotionRenderer from '@/components/NotionRenderer'
import TableOfContents from '@/components/TableOfContents'

/**
 * A post renderer
 *
 * @param {PostProps} props
 *
 * @typedef {object} PostProps
 * @prop {object}   post       - Post metadata
 * @prop {object}   document   - Post document data
 * @prop {boolean} [fullWidth] - Whether in full-width mode
 */
export default function Post (props) {
  const BLOG = useConfig()
  const { post, document, fullWidth = false } = props

  return (
    <article className={cn('flex flex-col', fullWidth ? 'md:px-24' : 'items-center')}>
      <h1 className={cn(
        'w-full font-bold text-3xl text-black dark:text-white',
        { 'max-w-2xl px-4': !fullWidth }
      )}>
        {post.title}
      </h1>
      {post.type[0] !== 'Page' && (
        <nav className={cn(
          'w-full flex mt-7 items-start text-gray-500 dark:text-gray-400',
          { 'max-w-2xl px-4': !fullWidth }
        )}>
          <div className="flex mb-4">
            <a href={BLOG.socialLink || '#'} className="flex">
              <p className="ml-2 md:block">{BLOG.author}</p>
            </a>
            <span className="block">&nbsp;/&nbsp;</span>
          </div>
          <div className="mr-2 mb-4 md:ml-0">
            <FormattedDate date={post.date} />
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
      <div className="self-stretch -mt-4 relative">
        <div className={fullWidth ? 'w-full px-4 md:px-24' : 'mx-auto w-full max-w-2xl px-4'}>
          <NotionRenderer document={document} />
        </div>
        {!fullWidth && (
          <div className="hidden xl:block absolute top-0 left-[calc(50%+22rem)] w-[220px]">
            {/* `65px` is the height of expanded nav */}
            {/* TODO: Remove the magic number */}
            <TableOfContents toc={document?.toc || []} className="pt-3 sticky" style={{ top: '65px' }} />
          </div>
        )}
      </div>
    </article>
  )
}

Post.propTypes = {
  post: PropTypes.object.isRequired,
  document: PropTypes.object.isRequired,
  fullWidth: PropTypes.bool
}
