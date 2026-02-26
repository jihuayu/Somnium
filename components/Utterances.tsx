'use client'

import { useEffect, useRef, useState } from 'react'

interface UtterancesProps {
  issueTerm: string
  repo: string
  appearance: 'light' | 'dark' | 'auto'
  layout?: string
}

const Utterances = ({ issueTerm, repo, appearance, layout }: UtterancesProps) => {
  const commentsRef = useRef<HTMLDivElement>(null)
  const [shouldLoad, setShouldLoad] = useState(false)

  useEffect(() => {
    const anchor = commentsRef.current
    if (!anchor) return

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true)
      return
    }

    const observer = new window.IntersectionObserver(
      entries => {
        const isVisible = entries.some(entry => entry.isIntersecting)
        if (!isVisible) return
        setShouldLoad(true)
        observer.disconnect()
      },
      { rootMargin: '300px 0px' }
    )

    observer.observe(anchor)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!repo || !shouldLoad) return

    const anchor = commentsRef.current
    if (!anchor) return

    const theme =
      appearance === 'auto'
        ? 'preferred-color-scheme'
        : appearance === 'light'
          ? 'github-light'
          : 'github-dark'

    const script = document.createElement('script')
    script.src = 'https://utteranc.es/client.js'
    script.crossOrigin = 'anonymous'
    script.async = true
    script.setAttribute('repo', repo)
    script.setAttribute('issue-term', issueTerm)
    script.setAttribute('theme', theme)
    anchor.replaceChildren(script)

    return () => {
      if (anchor.isConnected) {
        anchor.replaceChildren()
      }
    }
  }, [appearance, repo, issueTerm, shouldLoad])

  return (
    <div
      id="comments"
      ref={commentsRef}
      className={layout && layout === 'fullWidth' ? '' : 'md:-ml-16'}
    />
  )
}

export default Utterances
