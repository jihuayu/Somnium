import { defineConfig } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  { ignores: ['.cache/**', '.next/**', 'node_modules/**', 'packages/*/dist/**', 'packages/*/storybook-static/**'] },
  ...nextCoreWebVitals,
  {
    files: ['packages/notion-react/**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@next/next/no-img-element': 'off'
    }
  }
])
