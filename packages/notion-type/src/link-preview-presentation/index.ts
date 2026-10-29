import { defaultLinkPreviewPresentationAdapter } from './default'
import { githubLinkPreviewPresentationAdapter } from './github'
import {
  buildLinkPreviewPresentationContext,
  type LinkPreviewPresentation,
  type LinkPreviewPresentationAdapter,
  type LinkPreviewPresentationContext
} from './types'

export type {
  LinkPreviewKind,
  LinkPreviewPresentation,
  LinkPreviewPresentationAdapter,
  LinkPreviewPresentationContext
} from './types'
export { buildLinkPreviewPresentationContext } from './types'
export { defaultLinkPreviewPresentationAdapter } from './default'
export { githubLinkPreviewPresentationAdapter } from './github'

/**
 * EN: Ordered special presentation adapters. Add new site rules here; first match wins.
 * ZH: 按优先级排列的站点展示适配器。新增站点规则加在这里，先匹配先生效。
 */
export const linkPreviewPresentationAdapters: LinkPreviewPresentationAdapter[] = [
  githubLinkPreviewPresentationAdapter
]

/**
 * EN: Resolver returned by createLinkPreviewPresentationResolver.
 * ZH: createLinkPreviewPresentationResolver 返回的展示解析器。
 */
export interface LinkPreviewPresentationResolver {
  resolveAdapter: (ctx: LinkPreviewPresentationContext) => LinkPreviewPresentationAdapter
  getPresentation: (url: string, title?: string, hostname?: string) => LinkPreviewPresentation
  getMentionLabel: (href: string, textContent?: string) => string
}

/**
 * EN: Create a presentation resolver from ordered special adapters. Passing a list replaces the built-in special adapters; spread `linkPreviewPresentationAdapters` to keep GitHub. Default adapter is always last.
 * ZH: 用有序的特殊适配器创建展示解析器。传入列表会替换内置特殊适配器，保留 GitHub 时请展开 `linkPreviewPresentationAdapters`。默认适配器始终作为最后回落。
 */
export function createLinkPreviewPresentationResolver(
  specialAdapters: readonly LinkPreviewPresentationAdapter[] = linkPreviewPresentationAdapters
): LinkPreviewPresentationResolver {
  const resolveAdapter = (ctx: LinkPreviewPresentationContext) => (
    specialAdapters.find(item => item.matches(ctx)) || defaultLinkPreviewPresentationAdapter
  )

  return {
    resolveAdapter,
    getPresentation(url, title = '', hostname = '') {
      const ctx = buildLinkPreviewPresentationContext(url, title, hostname)
      return resolveAdapter(ctx).adapt(ctx)
    },
    getMentionLabel(href, textContent = '') {
      const trimmedText = `${textContent || ''}`.trim()
      if (trimmedText && !/^https?:\/\//i.test(trimmedText)) return trimmedText

      const ctx = buildLinkPreviewPresentationContext(href, '', '')
      if (!ctx.parsed) return trimmedText || 'link'

      return resolveAdapter(ctx).getMentionLabel?.(ctx)
        || defaultLinkPreviewPresentationAdapter.getMentionLabel?.(ctx)
        || trimmedText
        || 'link'
    }
  }
}

const defaultResolver = createLinkPreviewPresentationResolver()

/**
 * EN: Derive site-aware title/provider presentation for floating hover cards.
 * ZH: 为悬浮预览卡片按站点适配器推导标题与来源展示。正文书签卡不要调用。
 */
export function getLinkPreviewPresentation(
  url: string,
  title = '',
  hostname = ''
): LinkPreviewPresentation {
  return defaultResolver.getPresentation(url, title, hostname)
}

/**
 * EN: Derive the inline mention chip label, using site adapters when the visible text is a raw URL.
 * ZH: 推导行内提及标签；可见文本是原始 URL 时走站点适配器。
 */
export function getUrlMentionLabel(href: string, textContent = ''): string {
  return defaultResolver.getMentionLabel(href, textContent)
}
