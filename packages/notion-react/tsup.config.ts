import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      client: 'src/client.ts',
      data: 'src/data.ts',
      index: 'src/index.ts',
      prepare: 'src/prepare.ts',
      normalize: 'src/normalize.ts',
      rss: 'src/rss.ts',
      og: 'src/og.ts'
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['react', 'react-dom']
  },
  {
    entry: {
      styles: 'src/styles.css'
    },
    format: ['esm'],
    dts: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
    loader: {
      '.css': 'copy'
    }
  }
])
