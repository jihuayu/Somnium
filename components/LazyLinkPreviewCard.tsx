'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from 'react'
import cn from 'classnames'
import type { LinkPreviewCardProps, LinkPreviewData } from '@jihuayu/notion-react'
import { normalizePreviewUrl } from '@/lib/link-preview/normalize'

const previewRequestCache = new Map<string, Promise<LinkPreviewData | null>>()
const OG_PROXY_IMAGE_URL = 'https://og-proxy.raw2.cc/proxy/image'
const OG_PROXY_IMAGE_HOSTNAME = 'og-proxy.raw2.cc'
const OG_PROXY_IMAGE_PATHNAME = '/proxy/image'
const OG_PROXY_IMAGE_TRANSFORM_PARAMS = ['q', 'f', 'fit']

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return url
  }
}

function toOgProxyImageUrl(rawImageUrl: string, referer = ''): string {
  if (!rawImageUrl) return ''
  try {
    const parsed = new URL(rawImageUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return rawImageUrl
    if (parsed.hostname === OG_PROXY_IMAGE_HOSTNAME && parsed.pathname === OG_PROXY_IMAGE_PATHNAME) {
      for (const param of OG_PROXY_IMAGE_TRANSFORM_PARAMS) parsed.searchParams.delete(param)
      return parsed.toString()
    }
    const proxyUrl = new URL(OG_PROXY_IMAGE_URL)
    proxyUrl.searchParams.set('url', parsed.toString())
    if (referer) proxyUrl.searchParams.set('referer', referer)
    return proxyUrl.toString()
  } catch {
    return rawImageUrl
  }
}

function buildFallbackPreview(url: string): LinkPreviewData {
  const hostname = getHostname(url)
  const defaultIcon = hostname
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    : ''
  return {
    url,
    hostname,
    title: hostname || url,
    description: '',
    image: '',
    icon: toOgProxyImageUrl(defaultIcon, url)
  }
}

function loadPreview(url: string): Promise<LinkPreviewData | null> {
  const cached = previewRequestCache.get(url)
  if (cached) return cached

  const request = fetch(`/api/link-preview?${new URLSearchParams({ url }).toString()}`, {
    method: 'GET'
  })
    .then(async response => {
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload || typeof payload !== 'object') return null
      return payload as LinkPreviewData
    })
    .catch(() => null)

  previewRequestCache.set(url, request)
  return request
}

/**
 * EN: In-page bookmark card with lazy OG fetch. Keep the 110px horizontal layout; hover cards live in UrlMention.
 * ZH: 正文里的懒加载书签卡，保持 110px 横向布局。GitHub 风格只属于 UrlMention 悬浮预览。
 */
export default function LazyLinkPreviewCard({ url, className, preview }: LinkPreviewCardProps) {
  const hostRef = useRef<HTMLAnchorElement | null>(null)
  const normalizedUrl = normalizePreviewUrl(url) || ''
  const [remotePreviewState, setRemotePreviewState] = useState<{
    url: string
    preview: LinkPreviewData | null
  }>({ url: '', preview: null })
  const [imageFailed, setImageFailed] = useState(false)
  const remotePreview = remotePreviewState.url === normalizedUrl ? remotePreviewState.preview : null
  const fallback = buildFallbackPreview(normalizedUrl || url)
  const resolvedPreview = {
    ...fallback,
    ...(remotePreview || {}),
    ...(preview || {}),
    url: preview?.url || remotePreview?.url || normalizedUrl || fallback.url
  }

  const displayUrl = resolvedPreview.url || normalizedUrl
  const generatedImageUrl = displayUrl ? toOgProxyImageUrl(`${resolvedPreview.image || ''}`.trim(), displayUrl) : ''
  const iconUrl = displayUrl ? toOgProxyImageUrl(`${resolvedPreview.icon || ''}`.trim(), displayUrl) : ''
  const showImage = generatedImageUrl && !imageFailed

  useEffect(() => {
    if (preview || !normalizedUrl || !hostRef.current) return undefined

    let cancelled = false
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null

    const activate = () => {
      void loadPreview(normalizedUrl).then(nextPreview => {
        if (!cancelled && nextPreview) {
          setRemotePreviewState({ url: normalizedUrl, preview: nextPreview })
        }
      })
    }

    const scheduleActivate = () => {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        idleId = window.requestIdleCallback(activate, { timeout: 1200 })
      } else {
        idleTimer = globalThis.setTimeout(activate, 160)
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      scheduleActivate()
    }, { root: null, rootMargin: '480px 0px', threshold: 0.01 })
    observer.observe(hostRef.current)

    return () => {
      cancelled = true
      observer.disconnect()
      if (idleId !== null && typeof window !== 'undefined' && window.cancelIdleCallback) {
        window.cancelIdleCallback(idleId)
      }
      if (idleTimer !== null) globalThis.clearTimeout(idleTimer)
    }
  }, [normalizedUrl, preview])

  if (!displayUrl) return null

  return (
    <a
      ref={hostRef}
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-link-preview-card="true"
      data-has-image={showImage ? 'true' : 'false'}
      className={cn(
        'link-preview-card block my-4 h-[110px] rounded-md border border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="link-preview-card-inner flex h-full items-stretch">
        <div className={cn('link-preview-card-main min-w-0 flex flex-col px-3 py-2', showImage ? 'basis-[65%] shrink-0' : 'flex-1')}>
          <p className="text-base text-stone-900 dark:text-stone-100 font-medium truncate">
            {resolvedPreview.title || resolvedPreview.hostname || displayUrl}
          </p>
          {resolvedPreview.description && (
            <p
              className="mt-0.5 text-stone-600 dark:text-stone-300 text-sm leading-5 overflow-hidden"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
            >
              {resolvedPreview.description}
            </p>
          )}
          <div className="mt-auto pt-1.5 flex items-center gap-2 text-stone-800 dark:text-stone-200 text-xs">
            {iconUrl
              ? (
                <span className="relative h-4 w-4 rounded-sm flex-none overflow-hidden bg-transparent">
                  <img src={iconUrl} alt="" className="h-4 w-4 rounded-sm bg-transparent object-contain" loading="lazy" />
                </span>
                )
              : <span className="h-4 w-4 rounded-sm bg-stone-300 dark:bg-stone-700 flex-none" />}
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
        {showImage && (
          <div className="link-preview-card-media basis-[35%] shrink-0 h-full">
            <div className="relative h-full w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
              <img
                src={generatedImageUrl}
                alt=""
                className="link-preview-cover pointer-events-none h-full w-full object-cover transition-opacity duration-200"
                style={{ filter: 'none' }}
                loading="lazy"
                onError={() => setImageFailed(true)}
              />
            </div>
          </div>
        )}
      </div>
    </a>
  )
}
