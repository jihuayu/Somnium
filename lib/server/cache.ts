export const ONE_HOUR_SECONDS = 60 * 60
export const FIVE_MINUTES_SECONDS = 5 * 60
export const ONE_DAY_SECONDS = 60 * 60 * 24
export const SEVEN_DAYS_SECONDS = ONE_DAY_SECONDS * 7

// These names are owned by Somnium. Atrium can notify semantic changes but
// must never choose cache tags or arbitrary Next.js paths itself.
export const ATRIUM_BLOG_PAGE_CONTENT_CACHE_TAGS = [
  'atrium-blog-documents',
  'atrium-blog-feed-documents'
] as const

export const ATRIUM_BLOG_COLLECTION_CACHE_TAGS = [
  'sitemap',
  'atrium-blog-posts',
  'atrium-blog-feed',
  'atrium-blog-og',
  'page-link-map'
] as const

export const ATRIUM_BLOG_ALL_CACHE_TAGS = [
  ...ATRIUM_BLOG_PAGE_CONTENT_CACHE_TAGS,
  ...ATRIUM_BLOG_COLLECTION_CACHE_TAGS
] as const
