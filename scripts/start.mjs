import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import dotenv from 'dotenv'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(currentDir, '..')

process.env.PORT ||= '3000'

function loadEnvFile(fileName) {
  const filePath = path.join(projectRoot, fileName)
  if (!fs.existsSync(filePath)) return
  dotenv.config({ path: filePath, override: false })
}

loadEnvFile('.env')
loadEnvFile('.env.local')

await import(pathToFileURL(path.join(projectRoot, '.next/server/entry.mjs')).href)