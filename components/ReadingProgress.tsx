'use client'

import { useEffect, useRef } from 'react'

export default function ReadingProgress() {
  const barRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let rafId: number | null = null

    const update = () => {
      rafId = null
      const bar = barRef.current
      if (!bar) return

      const article = document.getElementById('post-article')
      if (!article) {
        bar.style.transform = 'scaleX(0)'
        return
      }

      const viewport = window.innerHeight
      const articleTop = article.offsetTop
      const articleHeight = article.offsetHeight
      const start = articleTop
      const end = articleTop + articleHeight - viewport
      const progress = end <= start
        ? (window.scrollY >= start ? 1 : 0)
        : Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)))

      bar.style.transform = `scaleX(${progress})`
    }

    const scheduleUpdate = () => {
      if (rafId !== null) return
      rafId = window.requestAnimationFrame(update)
    }

    scheduleUpdate()
    window.addEventListener('scroll', scheduleUpdate, { passive: true })
    window.addEventListener('resize', scheduleUpdate)
    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId)
      }
      window.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-px pointer-events-none">
      <div
        ref={barRef}
        className="h-full bg-stone-300/80 dark:bg-stone-600/70 transition-transform duration-75 ease-out will-change-transform"
        style={{ transform: 'scaleX(0)', transformOrigin: 'left center' }}
      />
    </div>
  )
}
