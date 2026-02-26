import { createRequire } from 'module'
import type { BlogConfig } from '@/lib/config'

const require = createRequire(import.meta.url)
const config = require('../../config/blog.config.js') as BlogConfig

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
