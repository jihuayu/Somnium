import { ogAdapter, type NotionOgAdapter } from './og'
import { rssAdapter, type NotionRssAdapter } from './rss'

/**
 * EN: Aggregated output adapters for non-render outputs.
 * ZH: 非渲染输出能力的聚合适配器。
 */
export interface NotionOutputAdapters {
  og: NotionOgAdapter
  rss: NotionRssAdapter
}

/**
 * EN: Optional overrides when creating output adapters.
 * ZH: 创建输出适配器时的可选覆盖项。
 */
export interface CreateNotionOutputAdaptersOptions {
  og?: Partial<NotionOgAdapter>
  rss?: Partial<NotionRssAdapter>
}

/**
 * EN: Default output adapters shipped by notion-type.
 * ZH: notion-type 内置的默认输出适配器。
 */
export const defaultNotionOutputAdapters: NotionOutputAdapters = {
  og: ogAdapter,
  rss: rssAdapter
}

/**
 * EN: Creates output adapters with partial module-level overrides.
 * ZH: 创建支持按模块局部覆盖的输出适配器实例。
 */
export function createNotionOutputAdapters(
  options: CreateNotionOutputAdaptersOptions = {}
): NotionOutputAdapters {
  return {
    og: {
      imageUrl: options.og?.imageUrl || defaultNotionOutputAdapters.og.imageUrl,
      payload: options.og?.payload || defaultNotionOutputAdapters.og.payload
    },
    rss: {
      documentHtml: options.rss?.documentHtml || defaultNotionOutputAdapters.rss.documentHtml,
      feed: options.rss?.feed || defaultNotionOutputAdapters.rss.feed
    }
  }
}