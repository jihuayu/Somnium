export const ONE_HOUR_SECONDS = 60 * 60
export const FIVE_MINUTES_SECONDS = 5 * 60
export const ONE_DAY_SECONDS = 60 * 60 * 24
export const SEVEN_DAYS_SECONDS = ONE_DAY_SECONDS * 7

export const DEFAULT_CACHE_REVALIDATE_TAGS = [
  'notion-posts',
  'notion-post-blocks',
  'notion-feed-posts',
  'feed-post-blocks',
  'notion-search-schema',
  'link-preview-metadata',
  'page-link-map'
] as const

export const DEFAULT_CACHE_REVALIDATE_PATHS = [
  '/',
  '/search',
  '/feed'
] as const
