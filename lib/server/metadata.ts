import type { Metadata } from 'next'
import { config } from '@/lib/server/config'
import { buildOgImageUrl, buildOpenGraphPayload } from '@jihuayu/notion-react/og'

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
  const ogImageUrl = buildOgImageUrl({
    baseUrl: config.ogImageGenerateURL,
    title: pageTitle,
    query: {
      theme: 'dark',
      md: 1,
      fontSize: '125px',
      images: 'https://nobelium.vercel.app/logo-for-dark-bg.svg'
    }
  })
  const publishedTime = toIsoDate(date)
  const ogPayload = buildOpenGraphPayload({
    title: pageTitle,
    description: pageDescription,
    siteUrl,
    slug,
    type,
    locale: config.lang,
    images: [{ url: ogImageUrl }],
    authors: [config.author],
    publishedTime
  })

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
    openGraph: ogPayload.openGraph as Metadata['openGraph'],
    twitter: {
      ...ogPayload.twitter
    }
  }
}
