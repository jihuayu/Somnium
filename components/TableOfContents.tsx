import type { TocItem } from '@/lib/notion/getPostBlocks'

interface TableOfContentsProps {
  toc: TocItem[]
}

export default function TableOfContents({ toc }: TableOfContentsProps) {
  if (!toc || !toc.length) return null

  function buildTargetId(id: string) {
    return `notion-heading-${id.replaceAll('-', '')}`
  }

  return (
    <nav
      aria-label="文章目录"
      className="article-toc"
    >
      {toc.map(node => (
        <div key={node.id}>
          <a
            href={`#${buildTargetId(node.id)}`}
            style={{ paddingLeft: (node.indentLevel * 16) + 'px' }}
            title={node.text}
          >
            {node.text}
          </a>
        </div>
      ))}
    </nav>
  )
}
