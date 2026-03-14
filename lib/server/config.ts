import 'server-only'
import type { BlogConfig } from '@/lib/config'
import rawConfig from '@/config/blog.config'

const config: BlogConfig = rawConfig

export { config }
