import cn from 'classnames'
import type { CSSProperties } from 'react'
import type { TocItem } from '@/lib/notion/getPostBlocks'

interface TableOfContentsProps {
  toc: TocItem[]
  className?: string
  style?: CSSProperties
}

export default function TableOfContents({ toc, className, style }: TableOfContentsProps) {
  if (!toc || !toc.length) return null

  function buildTargetId(id: string) {
    return `notion-heading-${id.replaceAll('-', '')}`
  }

  return (
    <aside
      className={cn(className, 'pl-2 text-sm text-zinc-700/70 dark:text-neutral-400')}
      style={style}
    >
      {toc.map(node => (
        <div key={node.id}>
          <a
            href={`#${buildTargetId(node.id)}`}
            className="block w-full py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis hover:text-black dark:hover:text-white cursor-pointer transition duration-100"
            style={{ paddingLeft: (node.indentLevel * 16) + 'px' }}
            title={node.text}
          >
            {node.text}
          </a>
        </div>
      ))}
    </aside>
  )
}
