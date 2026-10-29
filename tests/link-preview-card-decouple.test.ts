import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const lazyCardSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../components/LazyLinkPreviewCard.tsx'),
  'utf8'
)

test('LazyLinkPreviewCard stays decoupled from floating hover cards', () => {
  const source = lazyCardSource.replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(source, /getLinkPreviewPresentation/)
  assert.doesNotMatch(source, /notion-url-mention-hover/)
  assert.doesNotMatch(source, /UrlMentionHoverCard/)
  assert.match(source, /h-\[110px\]/)
  assert.match(source, /displayUrl/)
})
