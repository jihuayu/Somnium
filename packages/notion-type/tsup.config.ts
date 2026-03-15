import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
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
