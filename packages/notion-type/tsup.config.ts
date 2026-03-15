import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    adapters: 'src/adapters.ts',
    index: 'src/index.ts',
    normalize: 'src/normalize.ts',
    rss: 'src/rss.ts',
    og: 'src/og.ts'
  },
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2020'
})
