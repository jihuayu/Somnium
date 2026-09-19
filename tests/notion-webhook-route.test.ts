import assert from 'node:assert/strict'
import test from 'node:test'
import { GET, POST } from '../app/api/notion/webhook/route'

test('retired Notion webhook returns 410 for GET and POST', async () => {
  const [getResponse, postResponse] = await Promise.all([
    GET(),
    POST()
  ])

  assert.equal(getResponse.status, 410)
  assert.equal(postResponse.status, 410)
  assert.equal((await postResponse.json()).error, 'Notion webhook retired')
  assert.equal(getResponse.headers.get('cache-control'), 'no-store')
})
