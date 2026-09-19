'use client'

import { useEffect, useState } from 'react'
import cn from 'classnames'
import type { CSSProperties } from 'react'
import type { TocItem } from '@/lib/notion/getPostBlocks'

interface TableOfContentsProps {
  toc: TocItem[]
  className?: string
  style?: CSSProperties
  label?: string
}

function buildTargetId(id: string) {
  return `notion-heading-${id.replaceAll('-', '')}`
}

export default function TableOfContents({ toc, className, style, label }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    if (!toc.length) return undefined
    const headings = toc
      .map(item => document.getElementById(buildTargetId(item.id)))
      .filter((el): el is HTMLElement => !!el)

    if (!headings.length) return undefined

    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          setActiveId(visible[0].target.id)
        }
      },
      { rootMargin: '-72px 0px -70% 0px' }
    )

    headings.forEach(heading => observer.observe(heading))
    return () => observer.disconnect()
  }, [toc])

  if (!toc || !toc.length) return null

  const minIndent = Math.min(...toc.map(item => item.indentLevel))

  return (
    <nav
      aria-label={label || 'Table of contents'}
      className={cn(className, 'text-sm text-stone-400 dark:text-stone-500')}
      style={style}
    >
      {toc.map(node => {
        const targetId = buildTargetId(node.id)
        const isActive = activeId === targetId
        return (
          <div key={node.id}>
            <a
              href={`#${targetId}`}
              className={cn(
                'block w-full py-1 text-left whitespace-nowrap overflow-hidden text-ellipsis border-l cursor-pointer transition-colors duration-150 ease-out',
                isActive
                  ? 'border-stone-400 text-stone-800 dark:border-stone-500 dark:text-stone-100'
                  : 'border-transparent hover:text-stone-900 dark:hover:text-stone-100'
              )}
              style={{ paddingLeft: `${(node.indentLevel - minIndent) * 12 + 6}px` }}
              title={node.text}
            >
              {node.text}
            </a>
          </div>
        )
      })}
    </nav>
  )
}
