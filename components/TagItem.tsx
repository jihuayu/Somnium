import Link from 'next/link'

interface TagItemProps {
  tag: string
}

const TagItem = ({ tag }: TagItemProps) => (
  <Link href={`/tag/${encodeURIComponent(tag)}`} prefetch={false} className="article-tag">
    {tag}
  </Link>
)

export default TagItem
