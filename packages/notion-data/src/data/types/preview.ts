import type { PageHrefMap, PagePreviewMap, NotionDocument } from '@jihuayu/notion-type'
import type { NotionPageLike } from './core'
import type { BuildNotionDocumentOptions } from './document'
import type { NotionClient } from './client'

export interface NotionPagePreviewSource {
  id: string
  title?: string | null
  summary?: string | null
}

export interface BuildPagePreviewMapOptions {
  siteUrl: string
  buildImageUrl?: (pageId: string) => string
}

export interface PageOgData {
  id: string
  title: string
  summary: string
  coverUrl: string
  coverType: 'external' | 'file' | null
}

export interface NotionDerivedPageMetadata {
  id: string
  title: string
  summary: string
  tags: string[]
  slug: string
  url: string
  icon: string
}

export interface NotionDataLayer {
  client?: NotionClient
  plugins: import('./plugin').NotionPluginManager
  buildDocument(pageId: string, options?: BuildNotionDocumentOptions): Promise<NotionDocument | null>
  derivePageMetadata(page: NotionPageLike): Promise<NotionDerivedPageMetadata>
  mapPageToOgData(page: NotionPageLike): Promise<PageOgData>
  buildPagePreviewMap(items: NotionPagePreviewSource[], pageHrefMap: PageHrefMap, options: BuildPagePreviewMapOptions): PagePreviewMap
  resolveWebhookEvent(payload: import('./webhook').NotionWebhookPayload, options?: import('./webhook').ResolveNotionWebhookOptions): Promise<import('./webhook').NotionWebhookResolution>
}
