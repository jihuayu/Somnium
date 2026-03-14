import type { MetadataRoute } from 'next'
import { config } from '@/lib/server/config'
import { buildSiteAbsoluteUrl, buildSiteOrigin, buildSiteRelativePath } from '@/lib/server/sitemap'

export default function robots(): MetadataRoute.Robots {
  const siteOrigin = buildSiteOrigin(config.link || '')

  return {
    rules: {
      userAgent: '*',
      allow: '/'
    },
    host: siteOrigin,
    sitemap: buildSiteAbsoluteUrl(
      siteOrigin,
      buildSiteRelativePath(config.path || '', '/sitemap.xml')
    )
  }
}
