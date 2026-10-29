import cn from 'classnames'
import type { LinkPreviewCardProps } from '../types'
import { buildFallbackLinkPreview, normalizePreviewUrl, toOgProxyImageUrl } from '../utils/notion'

/**
 * EN: In-page Notion bookmark / link_preview card. Do not reuse UrlMentionHoverCard styles here.
 * ZH: 正文里的书签 / link_preview 卡片。不要复用悬浮预览 UrlMentionHoverCard 的结构和样式。
 */

export default function LinkPreviewCard({ url, className, preview }: LinkPreviewCardProps) {
  const normalizedUrl = normalizePreviewUrl(url) || ''
  const fallback = buildFallbackLinkPreview(normalizedUrl || url)
  const resolvedPreview = {
    ...fallback,
    ...(preview || {}),
    url: preview?.url || normalizedUrl || fallback.url
  }

  const displayUrl = resolvedPreview.url || normalizedUrl
  const generatedImageUrl = displayUrl ? toOgProxyImageUrl(`${resolvedPreview.image || ''}`.trim(), displayUrl) : ''
  const iconUrl = displayUrl ? toOgProxyImageUrl(`${resolvedPreview.icon || ''}`.trim(), displayUrl) : ''
  if (!displayUrl) return null

  return (
    <a
      href={displayUrl}
      target="_blank"
      rel="noopener noreferrer"
      data-link-preview-card="true"
      data-has-image={generatedImageUrl ? 'true' : 'false'}
      className={cn(
        'link-preview-card block my-4 h-[110px] rounded-md border border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600 transition-colors overflow-hidden bg-transparent opacity-100 hover:opacity-100',
        className
      )}
      style={{ opacity: 1 }}
    >
      <div className="link-preview-card-inner flex h-full items-stretch">
        <div className={cn('link-preview-card-main min-w-0 flex flex-col px-3 py-2', generatedImageUrl ? 'basis-[65%] shrink-0' : 'flex-1')}>
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
        {generatedImageUrl && (
          <div className="link-preview-card-media basis-[35%] shrink-0 h-full">
            <div className="relative h-full w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
              <img
                src={generatedImageUrl}
                alt=""
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
