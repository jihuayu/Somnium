import fs from 'fs'
import { resolve } from 'path'
import type { BlogConfig } from '@/lib/config'

const raw = fs.readFileSync(resolve(process.cwd(), 'blog.config.js'), 'utf-8')
const config: BlogConfig = eval(`((module = { exports: {} }) => { ${raw}; return module.exports })()`)

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
