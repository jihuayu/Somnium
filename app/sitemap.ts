import type { MetadataRoute } from 'next'
import { getSitemapEntries } from '@/lib/server/sitemap'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return getSitemapEntries()
}
