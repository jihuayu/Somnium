'use client'

import { useEffect } from 'react'

interface HeaderBehaviorProps {
  useSticky: boolean
}

export default function HeaderBehavior({ useSticky }: HeaderBehaviorProps) {
  useEffect(() => {
    const navEl = document.getElementById('sticky-nav')
    const sentinelEl = document.getElementById('header-sentinel')
    const titleEl = document.getElementById('header-title')

    if (!navEl || !sentinelEl) return

    if (!useSticky) {
      navEl.classList.add('remove-sticky')
      return
    }

    let collapseRaf: number | null = null
    const observer = new window.IntersectionObserver(([entry]) => {
      if (collapseRaf !== null) {
        window.cancelAnimationFrame(collapseRaf)
      }

      collapseRaf = window.requestAnimationFrame(() => {
        const sentinelBottom = sentinelEl.getBoundingClientRect().bottom
        const shouldCollapse = sentinelBottom <= 0 && window.scrollY > 0 && !entry.isIntersecting
        navEl.classList.toggle('sticky-nav-full', shouldCollapse)
        collapseRaf = null
      })
    })

    const handleNavClick = (event: MouseEvent) => {
      const target = event.target as EventTarget | null
      if (!target) return
      if (target !== navEl && target !== titleEl) return
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    observer.observe(sentinelEl)
    navEl.addEventListener('click', handleNavClick)

    return () => {
      if (collapseRaf !== null) {
        window.cancelAnimationFrame(collapseRaf)
      }
      observer.disconnect()
      navEl.removeEventListener('click', handleNavClick)
    }
  }, [useSticky])

  return null
}
