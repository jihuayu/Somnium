'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import cn from 'classnames'
import CodeBlockCopyButton from './CodeBlockCopyButton'

/** Delay before an overflowing code block lifts into its floating state. */
const EXPAND_DELAY_MS = 240
/** Time reserved for the collapse transition before the inline width is dropped. */
const COLLAPSE_RESET_MS = 520
/** Safe gap kept between the floating code block and the viewport edges. */
const VIEWPORT_PADDING = 24
/** Overflow smaller than this is treated as rounding noise. */
const OVERFLOW_EPSILON = 2

interface CodeBlockProps {
  contentId: string
  displayLanguage: string
  codeHtml: string
}

function measureOverflow(block: HTMLElement): number {
  let overflow = 0
  for (const scroller of block.querySelectorAll<HTMLElement>('.notion-code-content, .notion-code-content pre')) {
    overflow = Math.max(overflow, scroller.scrollWidth - scroller.clientWidth)
  }
  return overflow
}

export default function CodeBlock({ contentId, displayLanguage, codeHtml }: CodeBlockProps) {
  const blockRef = useRef<HTMLDivElement | null>(null)
  const expandTimerRef = useRef<number | null>(null)
  const resetTimerRef = useRef<number | null>(null)
  const restWidthRef = useRef(0)
  const restLeftRef = useRef(0)
  const expandedRef = useRef(false)
  const [expanded, setExpanded] = useState(false)

  const clearExpandTimer = useCallback(() => {
    if (expandTimerRef.current === null) return
    window.clearTimeout(expandTimerRef.current)
    expandTimerRef.current = null
  }, [])

  const clearResetTimer = useCallback(() => {
    if (resetTimerRef.current === null) return
    window.clearTimeout(resetTimerRef.current)
    resetTimerRef.current = null
  }, [])

  const expand = useCallback(() => {
    expandTimerRef.current = null
    const block = blockRef.current
    if (!block || expandedRef.current) return

    const overflow = measureOverflow(block)
    if (overflow <= OVERFLOW_EPSILON) return

    // An inline width means a collapse transition is still running, so the
    // cached resting geometry is the only reliable anchor.
    const rect = block.getBoundingClientRect()
    if (!block.style.width) {
      restWidthRef.current = rect.width
      restLeftRef.current = rect.left
    }

    const viewportWidth = document.documentElement.clientWidth
    const roomiestWidth = Math.max(restWidthRef.current, viewportWidth - VIEWPORT_PADDING * 2)
    const targetWidth = Math.max(restWidthRef.current, Math.min(rect.width + overflow, roomiestWidth))
    if (targetWidth - restWidthRef.current <= OVERFLOW_EPSILON) return

    // Slide left only when growing rightwards alone would leave the viewport.
    const overshoot = restLeftRef.current + targetWidth - (viewportWidth - VIEWPORT_PADDING)
    const shift = Math.max(0, Math.min(overshoot, restLeftRef.current - VIEWPORT_PADDING))

    clearResetTimer()
    // Pin the current width, flush layout, then animate towards the target:
    // width cannot transition away from `auto`.
    block.style.width = `${rect.width}px`
    block.getBoundingClientRect()
    block.style.width = `${targetWidth}px`
    block.style.transform = shift > 0 ? `translateX(${-shift}px)` : ''
    expandedRef.current = true
    setExpanded(true)
  }, [clearResetTimer])

  const collapse = useCallback((animate = true) => {
    clearExpandTimer()
    const block = blockRef.current
    if (!block || !expandedRef.current) return

    expandedRef.current = false
    setExpanded(false)
    block.style.transform = ''
    clearResetTimer()

    if (!animate) {
      block.style.width = ''
      return
    }

    block.style.width = `${restWidthRef.current}px`
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null
      if (expandedRef.current || !blockRef.current) return
      blockRef.current.style.width = ''
    }, COLLAPSE_RESET_MS)
  }, [clearExpandTimer, clearResetTimer])

  const handlePointerEnter = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') return
    clearExpandTimer()
    expandTimerRef.current = window.setTimeout(expand, EXPAND_DELAY_MS)
  }, [clearExpandTimer, expand])

  const handlePointerLeave = useCallback(() => collapse(), [collapse])

  useEffect(() => {
    if (!expanded) return undefined
    // Cached geometry is only valid for the current viewport, so drop the
    // floating state instead of animating towards a stale width.
    const handleViewportChange = () => collapse(false)
    window.addEventListener('resize', handleViewportChange)
    return () => window.removeEventListener('resize', handleViewportChange)
  }, [collapse, expanded])

  useEffect(() => () => {
    clearExpandTimer()
    clearResetTimer()
  }, [clearExpandTimer, clearResetTimer])

  return (
    <div
      ref={blockRef}
      className={cn('notion-code-block my-5 overflow-hidden', expanded && 'notion-code-block-expanded')}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <span className="notion-code-language notion-code-language-floating">{displayLanguage}</span>
      <CodeBlockCopyButton codeSelector={`#${contentId} code`} />
      <div
        id={contentId}
        className="notion-code-content"
        dangerouslySetInnerHTML={{ __html: codeHtml }}
      />
    </div>
  )
}
