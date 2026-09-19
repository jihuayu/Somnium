import Link from 'next/link'
import cn from 'classnames'

interface TagItemProps {
  tag: string
  className?: string
}

const TagItem = ({ tag, className }: TagItemProps) => (
  <Link
    href={`/tag/${encodeURIComponent(tag)}`}
    prefetch={false}
    className={cn(
      'transition-colors duration-150 ease-out hover:text-stone-700 dark:hover:text-stone-300',
      className
    )}
  >
    {tag}
  </Link>
)

export default TagItem
