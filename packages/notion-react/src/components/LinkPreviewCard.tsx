import cn from 'classnames'
import type { LinkPreviewCardProps } from '../types'
import { buildFallbackLinkPreview, normalizePreviewUrl } from '../utils/notion'

export default function LinkPreviewCard({ url, className, preview }: LinkPreviewCardProps) {
  const normalizedUrl = normalizePreviewUrl(url) || ''
  const fallback = buildFallbackLinkPreview(normalizedUrl || url)
  const resolvedPreview = {
    ...fallback,
    ...(preview || {}),
    url: preview?.url || normalizedUrl || fallback.url
  }

  const displayUrl = resolvedPreview.url || normalizedUrl
  const generatedImageUrl = displayUrl ? `${resolvedPreview.image || ''}`.trim() : ''
  if (!displayUrl) return null

  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-link-preview-card="true"
      data-has-image={generatedImageUrl ? 'true' : 'false'}
      className={cn(
        'link-preview-card block my-4 h-[110px] rounded-md border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="link-preview-card-inner flex h-full items-stretch">
        <div className={cn('link-preview-card-main min-w-0 flex flex-col px-3 py-2', generatedImageUrl ? 'basis-[65%] shrink-0' : 'flex-1')}>
          <p className="text-base text-zinc-900 dark:text-zinc-100 font-medium truncate">
            {resolvedPreview.title || resolvedPreview.hostname || displayUrl}
          </p>
          {resolvedPreview.description && (
            <p
              className="mt-0.5 text-zinc-600 dark:text-zinc-300 text-sm leading-5 overflow-hidden"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
            >
              {resolvedPreview.description}
            </p>
          )}
          <div className="mt-auto pt-1.5 flex items-center gap-2 text-zinc-800 dark:text-zinc-200 text-xs">
            {resolvedPreview.icon
              ? (
                <span className="relative h-4 w-4 rounded-sm flex-none overflow-hidden bg-transparent">
                  <img src={resolvedPreview.icon} alt="" className="h-4 w-4 rounded-sm bg-transparent object-contain" loading="lazy" />
                </span>
              )
              : <span className="h-4 w-4 rounded-sm bg-zinc-300 dark:bg-zinc-700 flex-none" />}
            <span className="truncate">{displayUrl}</span>
          </div>
        </div>
        {generatedImageUrl && (
          <div className="link-preview-card-media basis-[35%] shrink-0 h-full">
            <div className="relative h-full w-full overflow-hidden bg-zinc-200/80 dark:bg-zinc-700/70">
              <img
                src={generatedImageUrl}
                alt={resolvedPreview.title || resolvedPreview.hostname || 'Link preview'}
                className="link-preview-cover pointer-events-none h-full w-full object-cover transition-opacity duration-200"
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
