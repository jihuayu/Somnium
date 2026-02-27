'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'

interface UtterancesProps {
  issueTerm: string
  repo: string
  appearance: 'light' | 'dark' | 'auto'
  layout?: string
}

const UTTERANCES_ORIGIN = 'https://utteranc.raw2.cc'
const UTTERANCES_EMBED_MAX_WIDTH_PX = 760
const UTTERANCES_DEFAULT_HEIGHT_PX = 320
const UTTERANCES_MAX_DESCRIPTION_BYTES = 1000

const subscribeNoop = () => () => {}

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
}

function getTheme(appearance: UtterancesProps['appearance']): string {
  if (appearance === 'light') return 'github-light'
  if (appearance === 'dark') return 'github-dark'
  if (typeof window === 'undefined') return 'github-light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'github-dark'
    : 'github-light'
}

function trimByEncodedBytes(input: string, maxBytes: number): string {
  if (!input) return ''
  let value = input
  while (value && encodeURIComponent(value).length > maxBytes) {
    value = value.slice(0, -1)
  }
  return value
}

function buildEmbedSrc(repo: string, issueTerm: string, theme: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return ''

  const currentUrl = new URL(window.location.href)
  const sessionFromQuery = currentUrl.searchParams.get('utterances')
  currentUrl.searchParams.delete('utterances')

  const canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']")
  const descriptionMeta = document.querySelector<HTMLMetaElement>("meta[name='description']")
  const ogTitleMeta = document.querySelector<HTMLMetaElement>("meta[property='og:title'],meta[name='og:title']")

  const url = canonical?.href || `${currentUrl.origin}${currentUrl.pathname}${currentUrl.search}`
  const description = trimByEncodedBytes(descriptionMeta?.content || '', UTTERANCES_MAX_DESCRIPTION_BYTES)
  const pathname = currentUrl.pathname.length < 2
    ? 'index'
    : currentUrl.pathname.slice(1).replace(/\.\w+$/, '')
  const session = sessionFromQuery || localStorage.getItem('utterances-session') || ''

  const params = new URLSearchParams({
    repo,
    'issue-term': issueTerm,
    theme,
    url,
    origin: currentUrl.origin,
    pathname,
    title: document.title,
    description,
    'og:title': ogTitleMeta?.content || '',
    session
  })

  return `${UTTERANCES_ORIGIN}/utterances.html?${params.toString()}`
}

const Utterances = ({ issueTerm, repo, appearance, layout }: UtterancesProps) => {
  const isHydrated = useIsHydrated()
  const [height, setHeight] = useState(UTTERANCES_DEFAULT_HEIGHT_PX)
  const theme = useMemo(() => {
    if (!isHydrated) return 'github-light'
    return getTheme(appearance)
  }, [appearance, isHydrated])
  const src = useMemo(() => {
    if (!isHydrated || !repo) return ''
    return buildEmbedSrc(repo, issueTerm, theme)
  }, [isHydrated, repo, issueTerm, theme])

  useEffect(() => {
    if (!isHydrated) return

    const currentUrl = new URL(window.location.href)
    const sessionFromQuery = currentUrl.searchParams.get('utterances')
    if (!sessionFromQuery) return

    localStorage.setItem('utterances-session', sessionFromQuery)
    currentUrl.searchParams.delete('utterances')
    history.replaceState(undefined, document.title, currentUrl.href)
  }, [isHydrated])

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== UTTERANCES_ORIGIN) return
      const payload = event.data as { type?: string, height?: number | string } | null
      if (!payload || payload.type !== 'resize' || !payload.height) return

      const next = Number(payload.height)
      if (!Number.isFinite(next) || next <= 0) return
      setHeight(Math.ceil(next))
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (!isHydrated || !src) return null

  return (
    <div
      id="comments"
      className={layout && layout === 'fullWidth' ? '' : 'md:-ml-16'}
    >
      <div
        className="w-full mx-auto"
        style={{ maxWidth: `${UTTERANCES_EMBED_MAX_WIDTH_PX}px` }}
      >
        <iframe
          title="Comments"
          className="w-full border-0"
          src={src}
          loading="lazy"
          scrolling="no"
          style={{ height: `${height}px` }}
        />
      </div>
    </div>
  )
}

export default Utterances
