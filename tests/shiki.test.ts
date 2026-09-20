import assert from 'node:assert/strict'
import test from 'node:test'
import { highlightCodeToHtml } from '../lib/server/shiki'

test('bash angle-bracket placeholders are not split mid-word during highlighting', async () => {
  const { html } = await highlightCodeToHtml('mise run <task>', 'bash')

  assert.match(html, />task</)
  assert.doesNotMatch(html, />tas<\/span><span[^>]+>k</)
})

test('bash angle-bracket harmonization preserves real redirection examples', async () => {
  const { html } = await highlightCodeToHtml('cat <file>', 'bash')

  assert.match(html, />file</)
  assert.doesNotMatch(html, />fil<\/span><span[^>]+>e</)
})
