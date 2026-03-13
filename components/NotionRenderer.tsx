import { FONTS_MISANS } from '@/consts'
import {
  NotionRenderer as BaseNotionRenderer,
  prepareNotionRenderModel,
  type LinkPreviewMap,
  type NotionDocument,
  type NotionRenderOptions,
  type PageHrefMap
} from '@/packages/notion-react/src'
import { config } from '@/lib/server/config'
import { resolvePageHref } from '@/lib/notion/pageLinkMap'
import { buildNotionOgImageUrl } from '@/lib/server/metadata'
import { getLinkPreviewByNormalizedUrl } from '@/lib/server/linkPreview'
import { getPageOgData } from '@/lib/server/notionOg'
import { highlightCodeToHtml } from '@/lib/server/shiki'

function getSiteHostname(): string {
  const raw = `${config.link || ''}`.trim()
  if (!raw) return ''

  try {
    return new URL(raw).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

interface NotionRendererProps {
  document: NotionDocument | null
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageHrefMap
}

function buildRenderOptions(): NotionRenderOptions {
  const notionDateMention = config.notionDateMention || {
    display: 'relative',
    includeTime: 'always',
    absoluteDateFormat: 'YYYY年M月D日',
    absoluteDateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
    relativeStyle: 'short'
  }

  return {
    locale: config.lang,
    timeZone: config.timezone,
    dateMention: {
      displayMode: notionDateMention.display,
      includeTime: notionDateMention.includeTime,
      absoluteDateFormat: notionDateMention.absoluteDateFormat,
      absoluteDateTimeFormat: notionDateMention.absoluteDateTimeFormat,
      relativeStyle: notionDateMention.relativeStyle
    }
  }
}

export default async function NotionRenderer({ document, linkPreviewMap = {}, pageLinkMap = {} }: NotionRendererProps) {
  const siteHostname = getSiteHostname()
  const model = await prepareNotionRenderModel(document, {
    highlightCode: async (source, language) => {
      const highlighted = await highlightCodeToHtml(source, language)
      return {
        html: highlighted.html,
        displayLanguage: highlighted.displayLanguage
      }
    },
    resolveLinkPreview: getLinkPreviewByNormalizedUrl,
    resolvePageHref: id => resolvePageHref(id, pageLinkMap),
    resolvePagePreview: async (id) => {
      const pageOgData = await getPageOgData(id)
      if (!pageOgData) return null

      return {
        url: resolvePageHref(id, pageLinkMap),
        hostname: siteHostname,
        title: pageOgData.title,
        description: pageOgData.summary,
        image: buildNotionOgImageUrl(id),
        icon: '/favicon.png'
      }
    },
    initialLinkPreviewMap: linkPreviewMap,
    initialPageHrefMap: pageLinkMap
  })

  if (!model) return null

  return (
    <BaseNotionRenderer
      model={model}
      renderOptions={buildRenderOptions()}
      style={{ ['--notion-font-family' as string]: FONTS_MISANS.join(', ') }}
    />
  )
}
