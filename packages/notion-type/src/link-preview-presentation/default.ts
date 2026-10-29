import { applyCompactSlashTitle, type LinkPreviewPresentation, type LinkPreviewPresentationAdapter } from './types'

/**
 * EN: Fallback presentation adapter for generic URLs.
 * ZH: 通用链接的兜底展示适配器。
 */
export const defaultLinkPreviewPresentationAdapter: LinkPreviewPresentationAdapter = {
  id: 'default',
  matches: () => true,
  adapt: (ctx): LinkPreviewPresentation => {
    const title = applyCompactSlashTitle(ctx.fallbackTitle)
    return {
      adapterId: 'default',
      previewKind: 'default',
      titlePrefix: title.titlePrefix,
      titleName: title.titleName,
      providerLabel: ctx.hostLabel
    }
  },
  getMentionLabel: (ctx) => {
    const lastSegment = ctx.pathSegments[ctx.pathSegments.length - 1]
    if (lastSegment) return lastSegment
    return ctx.parsed?.hostname || ctx.hostLabel || 'link'
  }
}
