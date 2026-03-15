import type { NotionDataLayer, NotionDataLayerOptions, NotionPluginManager } from './types'
import { buildNotionDocument } from './document'
import { buildPagePreviewMap, deriveDefaultPageMetadata, mapPageToOgData } from './preview'
import { resolveNotionWebhookEvent } from './webhook'
import { unique } from './shared'

/**
 * EN: Creates plugin manager for metadata and webhook extension points.
 * ZH: 创建用于元数据与 webhook 扩展点的插件管理器。
 */
export function createNotionPluginManager(
  plugins: import('./types').NotionDataPlugin[] = [],
  context: import('./types').NotionDataPluginContext = {}
): NotionPluginManager {
  const registeredPlugins = [...plugins]

  return {
    list() {
      return registeredPlugins
    },
    use(plugin) {
      registeredPlugins.push(plugin)
    },
    async derivePageMetadata(page) {
      let metadata = deriveDefaultPageMetadata(page)
      for (const plugin of registeredPlugins) {
        const patch = await plugin.extendPageMetadata?.(page, metadata, context)
        if (patch) {
          metadata = {
            ...metadata,
            ...patch,
            tags: patch.tags ? unique(patch.tags) : metadata.tags
          }
        }
      }
      return metadata
    },
    async resolveWebhook(payload, resolution) {
      let current = resolution
      for (const plugin of registeredPlugins) {
        const patch = await plugin.extendWebhookResolution?.(payload, current, context)
        if (patch) {
          current = {
            ...current,
            ...patch,
            resolvedPagePath: patch.resolvedPagePath ?? current.resolvedPagePath
          }
        }
      }
      return current
    }
  }
}

/**
 * EN: Creates a high-level notion-data facade.
 * ZH: 创建 notion-data 的高层能力门面。
 */
export function createNotionDataLayer({ client, plugins = [] }: NotionDataLayerOptions = {}): NotionDataLayer {
  const pluginManager = createNotionPluginManager(plugins, { client })
  return {
    client,
    plugins: pluginManager,
    buildDocument(pageId, options) {
      if (!client) throw new Error('Notion data layer client is not configured')
      return buildNotionDocument(client, pageId, options)
    },
    derivePageMetadata(page) {
      return pluginManager.derivePageMetadata(page)
    },
    async mapPageToOgData(page) {
      const metadata = await pluginManager.derivePageMetadata(page)
      const og = mapPageToOgData(page)
      return {
        ...og,
        title: metadata.title || og.title,
        summary: metadata.summary || og.summary
      }
    },
    buildPagePreviewMap,
    async resolveWebhookEvent(payload, options) {
      const resolution = await resolveNotionWebhookEvent(payload, options)
      return pluginManager.resolveWebhook(payload, resolution)
    }
  }
}
