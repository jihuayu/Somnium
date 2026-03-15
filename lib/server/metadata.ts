import type { Metadata } from 'next'
import { config } from '@/lib/server/config'
import { buildOgImageUrl, buildOpenGraphPayload } from '@jihuayu/notion-type/og'

interface PageMetadataOptions {
  title?: string
  description?: string
  slug?: string
  type?: 'website' | 'article'
  date?: string | number | Date | null
  ogImageUrl?: string
}

function trimSlashes(value: string): string {
  return value.replace(/^\/+|\/+$/g, '')
}

function buildSiteOrigin(): string {
  const fallback = 'https://example.com'
  const source = `${config.link || ''}`.trim() || fallback

  try {
    return new URL(source).origin.replace(/\/+$/g, '')
  } catch {
    return fallback
  }
}

function buildSiteUrl(): string {
  const root = buildSiteOrigin()
  const basePath = trimSlashes(config.path || '')
  return basePath ? `${root}/${basePath}` : root
}

function buildPageUrl(siteUrl: string, slug?: string): string {
  const normalizedSlug = trimSlashes(slug || '')
  return normalizedSlug ? `${siteUrl}/${normalizedSlug}` : siteUrl
}

export function buildNotionOgImageUrl(pageId: string): string {
  const routeUrl = new URL('/api/og/notion', buildSiteOrigin())
  routeUrl.searchParams.set('pageId', pageId)
  return routeUrl.toString()
}

function buildTwitterHandle(value: string): string | undefined {
  const raw = `${value || ''}`.trim()
  if (!raw) return undefined

  if (raw.startsWith('@')) {
    return raw.length > 1 ? raw : undefined
  }

  try {
    const parsed = new URL(raw)
    const hostname = parsed.hostname.toLowerCase()
    if (hostname !== 'twitter.com' && hostname !== 'www.twitter.com' && hostname !== 'x.com' && hostname !== 'www.x.com') {
      return undefined
    }

    const handle = parsed.pathname.split('/').filter(Boolean)[0]
    if (!handle) return undefined
    return `@${handle.replace(/^@+/, '')}`
  } catch {
    return undefined
  }
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
  date,
  ogImageUrl
}: PageMetadataOptions = {}): Metadata {
  const pageTitle = title || config.title
  const pageDescription = description || config.description
  const siteUrl = buildSiteUrl()
  const pageUrl = buildPageUrl(siteUrl, slug)
  const resolvedOgImageUrl = ogImageUrl || buildOgImageUrl({
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
  const twitterHandle = buildTwitterHandle(config.socialLink || '')
  const ogPayload = buildOpenGraphPayload({
    title: pageTitle,
    description: pageDescription,
    siteUrl,
    slug,
    type,
    locale: config.lang,
    siteName: config.title,
    images: [{ url: resolvedOgImageUrl }],
    authors: [config.author],
    publishedTime,
    twitterSite: twitterHandle
  })

  return {
    title: pageTitle,
    description: pageDescription,
    applicationName: config.title,
    creator: config.author,
    publisher: config.title,
    robots: {
      follow: true,
      index: true
    },
    keywords: config.seo.keywords,
    verification: config.seo.googleSiteVerification
      ? { google: config.seo.googleSiteVerification }
      : undefined,
    alternates: {
      canonical: ogPayload.canonicalUrl || pageUrl
    },
    openGraph: ogPayload.openGraph as Metadata['openGraph'],
    twitter: {
      ...ogPayload.twitter,
      creator: twitterHandle
    }
  }
}
