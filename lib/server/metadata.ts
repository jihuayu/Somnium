import type { Metadata } from 'next'
import { config } from '@/lib/server/config'

interface PageMetadataOptions {
  title?: string
  description?: string
  slug?: string
  type?: 'website' | 'article'
  date?: string | number | Date | null
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function buildSiteUrl(): string {
  const root = config.link.replace(/\/+$/g, '')
  const basePath = trimSlashes(config.path || '')
  return basePath ? `${root}/${basePath}` : root
}

function buildPageUrl(siteUrl: string, slug?: string): string {
  const normalizedSlug = trimSlashes(slug || '')
  return normalizedSlug ? `${siteUrl}/${normalizedSlug}` : siteUrl
}

function buildOgImageUrl(title: string): string {
  const ogBaseUrl = config.ogImageGenerateURL.replace(/\/+$/g, '')
  const logoUrl = 'https://nobelium.vercel.app/logo-for-dark-bg.svg'
  return `${ogBaseUrl}/${encodeURIComponent(title)}.png?theme=dark&md=1&fontSize=125px&images=${encodeURIComponent(logoUrl)}`
}

function toIsoDate(value: string | number | Date | null | undefined): string | undefined {
  if (value === null || value === undefined) return undefined

  const parsed = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(parsed.getTime())) return undefined

  return parsed.toISOString()
}

export function buildPageMetadata({
  title,
  description,
  slug,
  type = 'website',
  date
}: PageMetadataOptions = {}): Metadata {
  const pageTitle = title || config.title
  const pageDescription = description || config.description
  const siteUrl = buildSiteUrl()
  const pageUrl = buildPageUrl(siteUrl, slug)
  const ogImageUrl = buildOgImageUrl(pageTitle)
  const publishedTime = toIsoDate(date)

  const openGraph = {
    locale: config.lang,
    title: pageTitle,
    description: pageDescription,
    url: pageUrl,
    images: [{ url: ogImageUrl }],
    type,
    ...(type === 'article'
      ? {
          authors: [config.author],
          ...(publishedTime ? { publishedTime } : {})
        }
      : {})
  } as Metadata['openGraph']

  return {
    title: pageTitle,
    description: pageDescription,
    robots: {
      follow: true,
      index: true
    },
    keywords: config.seo.keywords,
    verification: config.seo.googleSiteVerification
      ? { google: config.seo.googleSiteVerification }
      : undefined,
    alternates: {
      canonical: pageUrl
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title: pageTitle,
      description: pageDescription,
      images: [ogImageUrl]
    }
  }
}
