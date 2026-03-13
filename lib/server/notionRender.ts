import {
  prepareNotionRenderModel,
  type LinkPreviewMap,
  type NotionDocument,
  type NotionRenderModel,
  type PageHrefMap,
  type PagePreviewMap
} from '@/packages/notion-react/src'
import { resolvePageHref } from '@/lib/notion/pageLinkMap'
import { getLinkPreviewByNormalizedUrl } from '@/lib/server/linkPreview'
import { highlightCodeToHtml } from '@/lib/server/shiki'

interface PrepareNotionRenderModelInput {
  document: NotionDocument | null
  linkPreviewMap?: LinkPreviewMap
  pageLinkMap?: PageHrefMap
  pagePreviewMap?: PagePreviewMap
}

export async function prepareSomniumRenderModel({
  document,
  linkPreviewMap = {},
  pageLinkMap = {},
  pagePreviewMap = {}
}: PrepareNotionRenderModelInput): Promise<NotionRenderModel | null> {
  return prepareNotionRenderModel(document, {
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
}