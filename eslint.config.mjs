import { defineConfig } from 'eslint/config'

export default defineConfig([
  {
    ignores: [
      '.astro/**',
      '.cache/**',
      '.next/**',
      'app/**',
      'dist/**',
      'node_modules/**',
      'packages/*/dist/**',
      'packages/*/storybook-static/**',
      'src/**/*.astro'
    ]
  }
])
