/**
 * EN: Plugin extension contracts for notion-data.
 * ZH: notion-data 的插件扩展契约。
 */
import type { NotionClient } from './client'
import type { NotionPageLike } from './core'
import type { NotionDerivedPageMetadata } from './preview'
import type { NotionWebhookPayload, NotionWebhookResolution } from './webhook'

export interface NotionDataPluginContext {
  client?: NotionClient
}

export interface NotionDataPlugin {
  name: string
  extendPageMetadata?: (
    page: NotionPageLike,
    metadata: NotionDerivedPageMetadata,
    context: NotionDataPluginContext
  ) => Partial<NotionDerivedPageMetadata> | void | Promise<Partial<NotionDerivedPageMetadata> | void>
  extendWebhookResolution?: (
    payload: NotionWebhookPayload,
    resolution: NotionWebhookResolution,
    context: NotionDataPluginContext
  ) => Partial<NotionWebhookResolution> | void | Promise<Partial<NotionWebhookResolution> | void>
}

export interface NotionPluginManager {
  list(): readonly NotionDataPlugin[]
  use(plugin: NotionDataPlugin): void
  derivePageMetadata(page: NotionPageLike): Promise<NotionDerivedPageMetadata>
  resolveWebhook(payload: NotionWebhookPayload, resolution: NotionWebhookResolution): Promise<NotionWebhookResolution>
}

export interface NotionDataLayerOptions {
  client?: NotionClient
  plugins?: NotionDataPlugin[]
}
