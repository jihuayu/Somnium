import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'
import { GET, POST } from '../app/api/notion/webhook/route'

const notionSecret = 'test-notion-secret'
const callbackSecret = 'test-callback-secret'
const sign = (body: string, secret = notionSecret) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
const request = (body: string, signature = sign(body)) => new Request('https://blog.example/api/notion/webhook', {
  method: 'POST', body, headers: { 'x-notion-signature': signature, authorization: 'do-not-forward', cookie: 'private=1' }
})

test('Notion compatibility proxy', async (t) => {
  const previous = { ...process.env }
  process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = notionSecret
  process.env.CACHE_REVALIDATE_TOKEN = callbackSecret
  process.env.ATRIUM_BLOG_API_URL = 'https://atrium.example/api/v1/blog'
  delete process.env.NOTION_WEBHOOK_SIGNATURE_SECRET
  delete process.env.NOTION_WEBHOOK_TOKEN
  t.after(() => { process.env = previous })

  await t.test('forwards exact bytes only after authentication with an independently verifiable relay signature', async (t) => {
    const body = '{ "id": "event-one", "type": "page.content_updated", "text": "照片 🌄" }\n'
    const relaySecret = createHmac('sha256', callbackSecret).update('somnium:notion-webhook-relay:v1').digest('hex')
    const calls = t.mock.method(globalThis, 'fetch', async (url, init) => {
      assert.equal(String(url), 'https://atrium.example/api/v1/blog/webhooks/notion')
      assert.deepEqual(init?.body, Buffer.from(body))
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('x-notion-signature'), sign(body, relaySecret))
      assert.equal(headers.get('authorization'), null)
      assert.equal(headers.get('cookie'), null)
      assert.equal(init?.redirect, 'manual')
      return Response.json({ data: { duplicate: false, jobId: 'durable-job' } }, { status: 202 })
    })
    const response = await POST(request(body))
    assert.equal(response.status, 202)
    assert.equal((await response.json()).data.jobId, 'durable-job')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(calls.mock.callCount(), 1)
  })

  await t.test('rejects missing, wrong and tampered signatures without forwarding', async (t) => {
    const calls = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not forward') })
    for (const signature of ['', 'sha256=bad', sign('{}', 'wrong'), sign('{ }')]) {
      assert.equal((await POST(request('{}', signature))).status, 401)
    }
    assert.equal(calls.mock.callCount(), 0)
  })

  await t.test('fails closed without secrets or a valid HTTPS upstream', async (t) => {
    const calls = t.mock.method(globalThis, 'fetch', async () => { throw new Error('must not forward') })
    delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN
    assert.equal((await POST(request('{}'))).status, 503)
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = notionSecret
    const upstream = process.env.ATRIUM_BLOG_API_URL
    for (const value of ['', 'http://atrium.example/api/v1/blog', 'https://blog.example/api/v1/blog', 'https://user:pass@atrium.example']) {
      process.env.ATRIUM_BLOG_API_URL = value
      assert.equal((await POST(request('{}'))).status, 503)
    }
    process.env.ATRIUM_BLOG_API_URL = upstream
    assert.equal(calls.mock.callCount(), 0)
  })

  await t.test('preserves retryable upstream failures instead of acknowledging them', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'busy' }, { status: 503, headers: { 'Retry-After': '30' } }))
    const response = await POST(request('{}'))
    assert.equal(response.status, 503)
    assert.equal(response.headers.get('retry-after'), '30')
  })

  await t.test('rejects redirects and maps connection/timeout failures', async (t) => {
    const mock = t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 307, headers: { Location: 'https://elsewhere.example' } }))
    assert.equal((await POST(request('{}'))).status, 502)
    mock.mock.mockImplementation(async () => { throw new Error('connection') })
    assert.equal((await POST(request('{}'))).status, 502)
    mock.mock.mockImplementation(async () => { throw new DOMException('timeout', 'TimeoutError') })
    assert.equal((await POST(request('{}'))).status, 504)
  })

  await t.test('bounds payload size and rejects GET', async () => {
    assert.equal((await POST(request('x'.repeat(1024 * 1024 + 1)))).status, 413)
    assert.equal((await GET()).status, 405)
  })
})
