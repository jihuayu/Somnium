import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import vercel from '@astrojs/vercel'

const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [react()],
  vite: {
    resolve: {
      alias: [
        { find: '@jihuayu/notion-react/normalize', replacement: path.resolve(rootDir, 'packages/notion-react/src/normalize.ts') },
        { find: '@jihuayu/notion-react/rss', replacement: path.resolve(rootDir, 'packages/notion-react/src/rss.ts') },
        { find: '@jihuayu/notion-react/og', replacement: path.resolve(rootDir, 'packages/notion-react/src/og.ts') },
        { find: '@jihuayu/notion-react/styles.css', replacement: path.resolve(rootDir, 'packages/notion-react/src/styles.css') },
        { find: '@jihuayu/notion-react', replacement: path.resolve(rootDir, 'packages/notion-react/src/index.ts') },
        { find: '@', replacement: rootDir }
      ]
    }
  }
})