import {
  type LinkPreviewMap,
  type NotionRenderOptions,
} from '@jihuayu/notion-react'
import type { NotionDocument, PageHrefMap, PagePreviewMap } from '@jihuayu/notion-type'
import { prepareNotionRenderModel } from '@jihuayu/notion-react/prepare'
import NotionRendererClient from '@/components/NotionRendererClient'
import { config } from '@/lib/server/config'
import { resolvePageHref } from '@/lib/notion/pageLinkMap'
import { getLinkPreviewByNormalizedUrl } from '@/lib/server/linkPreview'
import { highlightCodeToHtml } from '@/lib/server/shiki'

interface NotionRendererProps {
  document: NotionDocument | null
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageHrefMap
  pagePreviewMap?: PagePreviewMap
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

export default async function NotionRenderer({ document, linkPreviewMap = {}, pageLinkMap = {}, pagePreviewMap = {} }: NotionRendererProps) {
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
    initialLinkPreviewMap: linkPreviewMap,
    initialPageHrefMap: pageLinkMap,
    initialPagePreviewMap: pagePreviewMap
  })

  if (!model) return null

  return (
    <NotionRendererClient
      model={model}
      renderOptions={buildRenderOptions()}
    />
  )
}
