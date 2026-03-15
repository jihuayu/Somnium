import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      client: 'src/client.ts',
      index: 'src/index.ts',
      prepare: 'src/prepare.ts'
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
    external: ['vue']
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
