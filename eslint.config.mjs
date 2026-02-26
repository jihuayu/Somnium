import { defineConfig } from 'eslint/config'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

export default defineConfig([
  { ignores: ['.cache/**', '.next/**', 'node_modules/**'] },
  ...nextCoreWebVitals
])
