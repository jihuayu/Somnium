import { decodePathSegment, parseUrl } from '../utils/notion'

/**
 * EN: Visual kind used by UrlMention floating hover cards only.
 * ZH: 仅用于 UrlMention 悬浮预览，不用于正文书签卡。
 */
export type LinkPreviewKind = 'github-repo' | 'github' | 'default' | (string & {})

/**
 * EN: Presentation hints for the floating URL hover card.
 * ZH: 悬浮链接预览卡片的展示信息。
 */
export interface LinkPreviewPresentation {
  adapterId: string
  previewKind: LinkPreviewKind
  titlePrefix: string
  titleName: string
  providerLabel: string
}

/**
 * EN: Shared input for link-preview presentation adapters.
 * ZH: 链接预览展示适配器的共享输入。
 */
export interface LinkPreviewPresentationContext {
  url: string
  title: string
  hostname: string
  parsed: URL | null
  hostLabel: string
  fallbackTitle: string
  pathSegments: string[]
}

/**
 * EN: Site-specific presentation adapter. First matching special adapter wins.
 * ZH: 按站点拆分的展示适配器。特殊适配器按注册顺序先匹配先生效。
 */
export interface LinkPreviewPresentationAdapter {
  id: string
  matches: (ctx: LinkPreviewPresentationContext) => boolean
  adapt: (ctx: LinkPreviewPresentationContext) => LinkPreviewPresentation
  getMentionLabel?: (ctx: LinkPreviewPresentationContext) => string | null
}

function getHostnameLabel(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase()
}

function splitCompactSlashTitle(title: string): { titlePrefix: string, titleName: string } | null {
  const slashIndex = title.indexOf('/')
  if (slashIndex > 0 && slashIndex < title.length - 1 && !/\s/.test(title)) {
    return {
      titlePrefix: title.slice(0, slashIndex + 1),
      titleName: title.slice(slashIndex + 1)
    }
  }
  return null
}

/**
 * EN: Split compact `owner/name` titles used by multiple adapters.
 * ZH: 多个适配器共用的无空格 `owner/name` 标题拆分。
 */
export function applyCompactSlashTitle(
  title: string
): Pick<LinkPreviewPresentation, 'titlePrefix' | 'titleName'> {
  const split = splitCompactSlashTitle(title)
  return {
    titlePrefix: split?.titlePrefix || '',
    titleName: split?.titleName || title
  }
}

/**
 * EN: Build the adapter context from a URL and optional title/hostname hints.
 * ZH: 从 URL 与可选标题、主机名提示构建适配器上下文。
 */
export function buildLinkPreviewPresentationContext(
  url: string,
  title = '',
  hostname = ''
): LinkPreviewPresentationContext {
  const parsed = parseUrl(url)
  const hostLabel = getHostnameLabel(parsed?.hostname || hostname || '')
  const fallbackTitle = `${title || hostLabel || url}`.trim()
  const pathSegments = parsed
    ? parsed.pathname.split('/').filter(Boolean).map(decodePathSegment)
    : []

  return {
    url,
    title,
    hostname,
    parsed,
    hostLabel,
    fallbackTitle,
    pathSegments
  }
}
