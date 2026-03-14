export const ONE_HOUR_SECONDS = 60 * 60
export const FIVE_MINUTES_SECONDS = 5 * 60
export const ONE_DAY_SECONDS = 60 * 60 * 24
export const SEVEN_DAYS_SECONDS = ONE_DAY_SECONDS * 7

export const DEFAULT_CACHE_REVALIDATE_TAGS = [
  'notion-posts',
  'notion-post-blocks',
  'notion-feed-posts',
  'feed-post-blocks',
  'notion-og-page',
  'notion-search-schema',
  'link-preview-metadata',
  'page-link-map'
] as const

export const DEFAULT_CACHE_REVALIDATE_PATHS = [
  '/',
  '/search',
  '/feed'
] as const

export const NOTION_WEBHOOK_REVALIDATE_TAGS = [
  'notion-posts',
  'notion-post-blocks',
  'notion-feed-posts',
  'feed-post-blocks',
  'notion-og-page',
  'notion-search-schema',
  'page-link-map'
] as const

export const NOTION_WEBHOOK_REVALIDATE_PATHS = [
  '/',
  '/search',
  '/feed',
  '/api/tags',
  // Dynamic route patterns are intentional here. The webhook layer resolves
  // concrete page paths when possible and uses these patterns only for broad
  // schema-level invalidation.
  '/[slug]',
  '/page/[page]',
  '/tag/[tag]'
] as const
