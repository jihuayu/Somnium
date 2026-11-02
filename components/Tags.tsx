import Link from 'next/link'

interface TagsProps {
  tags: Record<string, number>
  currentTag?: string
  query?: string
}

const Tags = ({ tags, currentTag, query = '' }: TagsProps) => {
  if (!tags || !Object.keys(tags).length) return null
  const queryString = query ? `?${new URLSearchParams({ q: query })}` : ''

  return (
    <nav className="search-tags" aria-label="按标签浏览">
      <ul>
        <li>
          <Link href={`/search${queryString}`} prefetch={false} aria-current={!currentTag ? 'page' : undefined}>全部</Link>
        </li>
        {Object.keys(tags).map(key => {
          const selected = key === currentTag
          return (
            <li key={key}>
              <Link
                href={`/tag/${encodeURIComponent(key)}${queryString}`}
                prefetch={false}
                aria-current={selected ? 'page' : undefined}
              >
                {key} <span className="tag-count">({tags[key]})</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export default Tags
