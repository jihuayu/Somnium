import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { POST } from '../app/api/notion/webhook/route'
import { computeNotionWebhookSignature } from '../lib/server/notionWebhook'

function createWebhookRequest(body: Record<string, unknown>, headers: HeadersInit = {}): NextRequest {
  return new NextRequest('http://localhost/api/notion/webhook', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...headers
    },
    body: JSON.stringify(body)
  })
}

function resetWebhookEnv() {
  delete process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN
  delete process.env.NOTION_WEBHOOK_TOKEN
  delete process.env.NOTION_WEBHOOK_SIGNATURE_SECRET
}

test('webhook route accepts events without auth when no auth env is configured', async () => {
  resetWebhookEnv()

  const response = await POST(createWebhookRequest({ type: 'workspace.updated' }))
  const payload = await response.json()

  assert.equal(response.status, 200)
  assert.equal(payload.ok, true)
  assert.equal(payload.ignored, true)
  assert.equal(payload.reason, 'ignored-event-type')
})

test('webhook route requires verification token only when configured', async () => {
  resetWebhookEnv()
  process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN = 'verify_secret'

  try {
    const rejected = await POST(createWebhookRequest({ type: 'workspace.updated' }))
    assert.equal(rejected.status, 401)
    assert.equal((await rejected.json()).error, 'Unauthorized')

    const accepted = await POST(createWebhookRequest({
      type: 'workspace.updated',
      verification_token: 'verify_secret'
    }))
    assert.equal(accepted.status, 200)
    assert.equal((await accepted.json()).ignored, true)
  } finally {
    resetWebhookEnv()
  }
})

test('webhook route requires signature only when configured', async () => {
  resetWebhookEnv()
  process.env.NOTION_WEBHOOK_SIGNATURE_SECRET = 'signing_secret'

  try {
    const body = { type: 'workspace.updated' }
    const rawBody = JSON.stringify(body)

    const rejected = await POST(createWebhookRequest(body))
    assert.equal(rejected.status, 401)
    assert.equal((await rejected.json()).error, 'Missing signature')

    const accepted = await POST(createWebhookRequest(body, {
      'x-notion-signature': computeNotionWebhookSignature(rawBody, 'signing_secret')
    }))
    assert.equal(accepted.status, 200)
    assert.equal((await accepted.json()).ignored, true)
  } finally {
    resetWebhookEnv()
  }
})
