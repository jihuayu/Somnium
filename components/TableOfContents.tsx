'use client'

import cn from 'classnames'
import type { TocItem } from '@/lib/notion/getPostBlocks'

interface TableOfContentsProps {
  toc: TocItem[]
  className?: string
  style?: React.CSSProperties
}

export default function TableOfContents({ toc, className, style }: TableOfContentsProps) {
  if (!toc || !toc.length) return null

  function scrollTo(id: string) {
    const cleanId = id.replaceAll('-', '')
    const target = document.querySelector(`.notion-block-${cleanId}`)
    if (!target) return
    const top = document.documentElement.scrollTop + target.getBoundingClientRect().top - 65
    document.documentElement.scrollTo({
      top,
      behavior: 'smooth'
    })
  }

  return (
    <aside
      className={cn(className, 'pl-2 text-sm text-zinc-700/70 dark:text-neutral-400')}
      style={style}
    >
      {toc.map(node => (
        <div key={node.id}>
          <button
            type="button"
            data-target-id={node.id}
            className="block w-full py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis hover:text-black dark:hover:text-white cursor-pointer transition duration-100"
            style={{ paddingLeft: (node.indentLevel * 16) + 'px' }}
            onClick={() => scrollTo(node.id)}
            title={node.text}
          >
            {node.text}
          </button>
        </div>
      ))}
    </aside>
  )
}
