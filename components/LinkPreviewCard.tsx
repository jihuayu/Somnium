import cn from 'classnames'
import type { LinkPreviewData } from '@/lib/link-preview/types'
import { getLinkPreview, normalizePreviewUrl } from '@/lib/server/linkPreview'
import { toLinkPreviewImageProxyUrl } from '@/lib/server/linkPreviewImageProxy'

interface LinkPreviewCardProps {
  url: string
  className?: string
  initialData?: LinkPreviewData
}

function buildFallback(url: string): LinkPreviewData {
  if (!url) {
    return { url: '', hostname: '', title: '', description: '', image: '', icon: '' }
  }

  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const iconSource = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=32`
    return {
      url: parsed.toString(),
      hostname,
      title: hostname,
      description: '',
      image: '',
      icon: toLinkPreviewImageProxyUrl(iconSource)
    }
  } catch {
    return { url, hostname: '', title: url, description: '', image: '', icon: '' }
  }
}

function mergePreview(
  normalizedUrl: string,
  fallback: LinkPreviewData,
  data: Partial<LinkPreviewData> | null | undefined
): LinkPreviewData {
  return {
    ...fallback,
    ...(data || {}),
    url: data?.url || normalizedUrl
  }
}

function buildLinkPreviewOgImageUrl(preview: LinkPreviewData, fallbackUrl: string): string {
  if (!preview.image) return ''
  const params = new URLSearchParams()
  params.set('image', preview.image)
  params.set('url', preview.url || fallbackUrl)
  return `/api/link-preview/og?${params.toString()}`
}

async function resolvePreviewData(
  normalizedUrl: string,
  fallback: LinkPreviewData,
  initialData?: LinkPreviewData
): Promise<LinkPreviewData> {
  if (!normalizedUrl) return fallback
  if (initialData) return mergePreview(normalizedUrl, fallback, initialData)

  const fetched = await getLinkPreview(normalizedUrl)
  return mergePreview(normalizedUrl, fallback, fetched || null)
}

export function LinkPreviewCardFallback({ className }: { className?: string }) {
  return (
    <div className={cn('block my-4 rounded-md border border-blue-300/60 overflow-hidden bg-transparent', className)}>
      <div className="flex items-stretch">
        <div className="min-w-0 flex flex-1 flex-col px-4 py-3">
          <div className="h-5 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="mt-2 h-4 w-full rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="mt-2 h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
          <div className="mt-auto pt-2 h-4 w-2/5 rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
        </div>
        <div className="hidden sm:flex shrink-0 items-center justify-center px-2">
          <div className="h-28 w-40 md:h-36 md:w-52 lg:h-40 lg:w-56 rounded-sm bg-zinc-200/80 dark:bg-zinc-700/70 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

export default async function LinkPreviewCard({ url, className, initialData }: LinkPreviewCardProps) {
  const normalizedUrl = normalizePreviewUrl(url) || ''
  const fallback = buildFallback(normalizedUrl || url)
  const preview = await resolvePreviewData(normalizedUrl, fallback, initialData)
  const displayUrl = preview.url || normalizedUrl
  const generatedImageUrl = displayUrl ? buildLinkPreviewOgImageUrl(preview, displayUrl) : ''

  if (!displayUrl) return null

  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-link-preview-card="true"
      className={cn(
        'block my-4 rounded-md border border-blue-400/70 hover:border-blue-500 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="flex items-stretch">
        <div className="min-w-0 flex flex-1 flex-col px-4 py-3">
          <p className="text-base text-zinc-900 dark:text-zinc-100 font-medium truncate">
            {preview.title || preview.hostname || displayUrl}
          </p>
          {preview.description && (
            <p
              className="mt-1 text-zinc-600 dark:text-zinc-300 text-sm leading-6 overflow-hidden"
              style={{
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical'
              }}
            >
              {preview.description}
            </p>
          )}
          <div className="mt-auto pt-2 flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-xs">
            {preview.icon ? (
              <span className="relative h-4 w-4 rounded-sm flex-none overflow-hidden bg-zinc-300 dark:bg-zinc-700">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.icon}
                  alt=""
                  className="h-4 w-4 rounded-sm"
                  loading="lazy"
                />
              </span>
            ) : (
              <span className="h-4 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-700 flex-none" />
            )}
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
        {generatedImageUrl && (
          <div className="hidden sm:flex shrink-0 items-center justify-center px-2">
            <div className="relative h-28 w-40 md:h-36 md:w-52 lg:h-40 lg:w-56 overflow-hidden rounded-sm bg-zinc-200/80 dark:bg-zinc-700/70">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={generatedImageUrl}
                alt={preview.title || preview.hostname || 'Link preview'}
                className="link-preview-cover pointer-events-none h-full w-full rounded-sm object-cover transition-opacity duration-200"
                style={{ filter: 'none' }}
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>
    </a>
  )
}
