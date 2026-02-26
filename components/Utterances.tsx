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
  const [shouldLoad, setShouldLoad] = useState(() => {
    if (typeof document === 'undefined') return false
    return document.readyState === 'complete'
  })

  useEffect(() => {
    if (shouldLoad) return

    const handleLoad = () => setShouldLoad(true)
    window.addEventListener('load', handleLoad, { once: true })
    return () => window.removeEventListener('load', handleLoad)
  }, [shouldLoad])

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
    script.src = 'https://utteranc.raw2.cc/client.js'
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
