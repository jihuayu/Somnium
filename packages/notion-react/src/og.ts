export interface OgImageDescriptor {
  url: string
  alt?: string
  width?: number
  height?: number
}

export interface BuildOgImageUrlOptions {
  baseUrl: string
  title: string
  extension?: string
  query?: Record<string, string | number | boolean | null | undefined>
}

export interface BuildOpenGraphPayloadOptions {
  title: string
  description: string
  siteUrl: string
  slug?: string
  type?: 'website' | 'article'
  locale?: string
  siteName?: string
  images?: Array<string | OgImageDescriptor>
  publishedTime?: string | number | Date | null
  authors?: string[]
  twitterCard?: 'summary' | 'summary_large_image' | 'app' | 'player'
  twitterSite?: string
}

export interface OpenGraphPayload {
  title: string
  description: string
  canonicalUrl: string
  openGraph: {
    title: string
    description: string
    url: string
    type: 'website' | 'article'
    locale?: string
    siteName?: string
    images: OgImageDescriptor[]
    authors?: string[]
    publishedTime?: string
  }
  twitter: {
    card: 'summary' | 'summary_large_image' | 'app' | 'player'
    title: string
    description: string
    images: string[]
    site?: string
  }
}

function trimSlashes(value: string): string {
  return `${value || ''}`.replace(/^\/+|\/+$/g, '')
}

function toAbsoluteUrl(siteUrl: string, slug?: string): string {
  const normalizedSiteUrl = `${siteUrl || ''}`.trim() || 'https://example.com'
  try {
    const base = new URL(normalizedSiteUrl)
    const normalizedSlug = trimSlashes(slug || '')
    if (!normalizedSlug) return base.toString().replace(/\/+$/g, '')
    return new URL(normalizedSlug, `${base.toString().replace(/\/?$/, '/')}`).toString()
  } catch {
    return normalizedSiteUrl
  }
}

function toIsoDate(value: string | number | Date | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString()
}

export function buildOgImageUrl({
  baseUrl,
  title,
  extension = 'png',
  query = {}
}: BuildOgImageUrlOptions): string {
  const normalizedBaseUrl = `${baseUrl || ''}`.trim().replace(/\/+$/g, '')
  const encodedTitle = encodeURIComponent(`${title || ''}`.trim() || 'Untitled')
  const suffix = extension ? `.${extension.replace(/^\./, '')}` : ''
  const url = `${normalizedBaseUrl}/${encodedTitle}${suffix}`

  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') continue
    searchParams.set(key, `${value}`)
  }

  const search = searchParams.toString()
  return search ? `${url}?${search}` : url
}

export function buildOpenGraphPayload({
  title,
  description,
  siteUrl,
  slug,
  type = 'website',
  locale,
  siteName,
  images = [],
  publishedTime,
  authors,
  twitterCard = 'summary_large_image',
  twitterSite
}: BuildOpenGraphPayloadOptions): OpenGraphPayload {
  const canonicalUrl = toAbsoluteUrl(siteUrl, slug)
  const normalizedImages = images.map((image) => typeof image === 'string' ? { url: image } : image)

  return {
    title,
    description,
    canonicalUrl,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type,
      locale,
      siteName,
      images: normalizedImages,
      authors: type === 'article' ? authors : undefined,
      publishedTime: type === 'article' ? toIsoDate(publishedTime) : undefined
    },
    twitter: {
      card: twitterCard,
      title,
      description,
      images: normalizedImages.map(image => image.url),
      site: twitterSite
    }
  }
}
