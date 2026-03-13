import type { BlogConfig } from '@/lib/config'
import blogConfig from '@/config/blog.config.mjs'

const config = blogConfig as BlogConfig

// If we need to strip out some private fields
const clientConfig: BlogConfig = { ...config }

for (const key of [
  'notionAccessToken',
  'notionPageId',
  'notionIntegrationToken',
  'notionDataSourceId',
  'notionApiVersion'
] as const) {
  delete (clientConfig as any)[key]
}

export { config, clientConfig }
