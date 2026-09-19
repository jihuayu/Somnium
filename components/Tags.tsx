import Link from 'next/link'
import cn from 'classnames'

interface TagsProps {
  tags: Record<string, number>
  currentTag?: string
  className?: string
}

const Tags = ({ tags, currentTag, className }: TagsProps) => {
  const names = Object.keys(tags || {}).sort((left, right) => left.localeCompare(right))
  if (names.length === 0) return null

  return (
    <nav className={cn('flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm text-stone-400 dark:text-stone-500', className)}>
      {names.map(name => {
        const selected = name === currentTag
        return (
          <Link
            key={name}
            href={selected ? '/search' : `/tag/${encodeURIComponent(name)}`}
            prefetch={false}
            aria-current={selected ? 'page' : undefined}
            className={cn(
              'transition-colors duration-150 ease-out',
              selected
                ? 'text-stone-900 dark:text-stone-100'
                : 'hover:text-stone-800 dark:hover:text-stone-200'
            )}
          >
            {name}
          </Link>
        )
      })}
    </nav>
  )
}

export default Tags
