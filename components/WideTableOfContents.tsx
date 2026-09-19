'use client'

import { useState, useEffect, useRef } from 'react'
import cn from 'classnames'
import type { TocItem } from '@/lib/notion/getPostBlocks'

interface WideTableOfContentsProps {
  toc: TocItem[]
  openLabel?: string
  closeLabel?: string
}

function buildTargetId(id: string) {
  return `notion-heading-${id.replaceAll('-', '')}`
}

export default function WideTableOfContents({ toc, openLabel = 'Contents', closeLabel = 'Close' }: WideTableOfContentsProps) {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (!open) return undefined
    const handler = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!toc || !toc.length) return null

  const minIndent = Math.min(...toc.map(item => item.indentLevel))

  return (
    <div
      ref={panelRef}
      className="fixed bottom-6 right-6 z-30 hidden md:block"
    >
      {open && (
        <nav
          aria-label={openLabel}
          className="mb-3 max-h-[60vh] w-64 overflow-y-auto border border-stone-200/80 bg-day/95 p-3 backdrop-blur-sm dark:border-stone-700/70 dark:bg-night/95"
        >
          {toc.map(node => {
            const targetId = buildTargetId(node.id)
            const isActive = activeId === targetId
            return (
              <a
                key={node.id}
                href={`#${targetId}`}
                onClick={() => setOpen(false)}
                className={cn(
                  'block w-full py-1.5 text-left text-sm border-l cursor-pointer transition-colors duration-150',
                  isActive
                    ? 'border-stone-400 text-stone-800 dark:border-stone-500 dark:text-stone-100'
                    : 'border-transparent text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
                )}
                style={{ paddingLeft: `${(node.indentLevel - minIndent) * 12 + 6}px` }}
                title={node.text}
              >
                <span className="block whitespace-nowrap overflow-hidden text-ellipsis">{node.text}</span>
              </a>
            )
          })}
        </nav>
      )}
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label={open ? closeLabel : openLabel}
        aria-expanded={open}
        className="ml-auto block text-sm text-stone-400 transition-colors duration-150 ease-out hover:text-stone-900 dark:text-stone-500 dark:hover:text-stone-100"
      >
        {open ? closeLabel : openLabel}
      </button>
    </div>
  )
}
