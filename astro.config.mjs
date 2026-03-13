import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import node from '@astrojs/node'

const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  outDir: '.next',
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  build: {
    client: './static',
    server: './server'
  },
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