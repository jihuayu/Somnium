'use client'

import { useConfig } from '@/lib/config'
import { useEffect, useRef } from 'react'

interface UtterancesProps {
  issueTerm: string
  layout?: string
}

const Utterances = ({ issueTerm, layout }: UtterancesProps) => {
  const BLOG = useConfig()
  const commentsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const provider = BLOG.comment?.provider
    const repo = BLOG.comment?.utterancesConfig?.repo
    if (provider !== 'utterances' || !repo) return

    const anchor = commentsRef.current
    if (!anchor) return

    const theme =
      BLOG.appearance === 'auto'
        ? 'preferred-color-scheme'
        : BLOG.appearance === 'light'
          ? 'github-light'
          : 'github-dark'

    let cancelled = false
    const timer = window.setTimeout(() => {
      if (cancelled || !anchor.isConnected) return

      const script = document.createElement('script')
      script.src = 'https://utteranc.es/client.js'
      script.crossOrigin = 'anonymous'
      script.async = true
      script.setAttribute('repo', repo)
      script.setAttribute('issue-term', issueTerm)
      script.setAttribute('theme', theme)
      anchor.replaceChildren(script)
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (anchor.isConnected) {
        anchor.replaceChildren()
      }
    }
  }, [BLOG.appearance, BLOG.comment?.provider, BLOG.comment?.utterancesConfig?.repo, issueTerm])

  return (
    <div
      id="comments"
      ref={commentsRef}
      className={layout && layout === 'fullWidth' ? '' : 'md:-ml-16'}
    />
  )
}

export default Utterances
