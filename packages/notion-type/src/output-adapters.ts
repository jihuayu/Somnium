import { ogAdapter, type NotionOgAdapter } from './og'
import { rssAdapter, type NotionRssAdapter } from './rss'

export interface NotionOutputAdapters {
  og: NotionOgAdapter
  rss: NotionRssAdapter
}

export interface CreateNotionOutputAdaptersOptions {
  og?: Partial<NotionOgAdapter>
  rss?: Partial<NotionRssAdapter>
}

export const defaultNotionOutputAdapters: NotionOutputAdapters = {
  og: ogAdapter,
  rss: rssAdapter
}

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