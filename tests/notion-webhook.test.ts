import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeNotionWebhookSignature,
  isNotionVerificationRequest,
  isValidNotionWebhookSignature,
  resolveNotionWebhookRevalidation
} from '../lib/server/notionWebhook'

test('isNotionVerificationRequest detects verification payloads', () => {
  assert.equal(
    isNotionVerificationRequest({ verification_token: 'secret_123' }),
    true
  )
  assert.equal(
    isNotionVerificationRequest({ verification_token: 'secret_123', type: 'page.created' }),
    false
  )
})

test('isValidNotionWebhookSignature validates sha256 signatures', () => {
  const body = JSON.stringify({
    verification_token: 'secret_123',
    type: 'page.content_updated',
    entity: { id: 'page-1', type: 'page' }
  })
  const signature = computeNotionWebhookSignature(body, 'secret_123')

  assert.equal(isValidNotionWebhookSignature(body, 'secret_123', signature), true)
  assert.equal(isValidNotionWebhookSignature(body, 'secret_123', 'sha256=bad'), false)
})

test('resolveNotionWebhookRevalidation accepts verification payloads without revalidation', async () => {
  const result = await resolveNotionWebhookRevalidation({
    verification_token: 'secret_123'
  })

  assert.equal(result.accepted, true)
  assert.equal(result.isVerificationRequest, true)
  assert.equal(result.shouldRevalidate, false)
})

test('resolveNotionWebhookRevalidation refreshes for matching data source events', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'data_source.schema_updated',
      entity: {
        id: '15b104cd477e80c284a0c32cefba5cff',
        type: 'data_source'
      }
    },
    {
      configuredDataSourceId: '15b104cd-477e-80c2-84a0-c32cefba5cff'
    }
  )

  assert.equal(result.shouldRevalidate, true)
  assert.ok(result.tags.includes('notion-posts'))
  assert.ok(result.tags.includes('notion-og-page'))
  assert.ok(result.paths.includes('/feed'))
  assert.ok(result.paths.includes('/[slug]'))
})

test('resolveNotionWebhookRevalidation refreshes only the page path for page updates', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'page.content_updated',
      entity: {
        id: '153104cd-477e-809d-8dc4-ff2d96ae3090',
        type: 'page'
      }
    },
    {
      configuredDataSourceId: '15b104cd-477e-80c2-84a0-c32cefba5cff',
      resolvePageParentDataSourceId: async () => '15b104cd-477e-80c2-84a0-c32cefba5cff',
      resolvePagePath: async () => '/gpt-might-be-an-information-virus'
    }
  )

  assert.equal(result.shouldRevalidate, true)
  assert.deepEqual(result.tags, [])
  assert.deepEqual(result.paths, ['/gpt-might-be-an-information-virus'])
})

test('resolveNotionWebhookRevalidation refreshes only home for page creation', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'page.created',
      entity: {
        id: '153104cd-477e-809d-8dc4-ff2d96ae3090',
        type: 'page'
      },
      data: {
        parent: {
          id: '15b104cd-477e-80c2-84a0-c32cefba5cff',
          type: 'data_source'
        }
      }
    },
    {
      configuredDataSourceId: '15b104cd-477e-80c2-84a0-c32cefba5cff'
    }
  )

  assert.equal(result.shouldRevalidate, true)
  assert.deepEqual(result.tags, [])
  assert.deepEqual(result.paths, ['/'])
})

test('resolveNotionWebhookRevalidation refreshes only home and the page path for page deletion', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'page.deleted',
      entity: {
        id: '153104cd-477e-809d-8dc4-ff2d96ae3090',
        type: 'page'
      },
      data: {
        parent: {
          id: '15b104cd-477e-80c2-84a0-c32cefba5cff',
          type: 'data_source'
        },
        properties: {
          slug: {
            type: 'rich_text',
            rich_text: [{ plain_text: 'deleted-post' }]
          }
        }
      }
    },
    {
      configuredDataSourceId: '15b104cd-477e-80c2-84a0-c32cefba5cff'
    }
  )

  assert.equal(result.shouldRevalidate, true)
  assert.deepEqual(result.tags, [])
  assert.deepEqual(result.paths, ['/', '/deleted-post'])
})

test('resolveNotionWebhookRevalidation ignores container content events to avoid broad invalidation', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'data_source.content_updated',
      entity: {
        id: '15b104cd477e80c284a0c32cefba5cff',
        type: 'data_source'
      }
    },
    {
      configuredDataSourceId: '15b104cd-477e-80c2-84a0-c32cefba5cff'
    }
  )

  assert.equal(result.shouldRevalidate, false)
  assert.equal(result.reason, 'ignored-container-content-event')
})

test('resolveNotionWebhookRevalidation ignores unrelated data sources', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'data_source.content_updated',
      entity: {
        id: '15b104cd-477e-80c2-84a0-c32cefba5cff',
        type: 'data_source'
      }
    },
    {
      configuredDataSourceId: '263104cd-477e-804b-8c32-000b2fcd241a'
    }
  )

  assert.equal(result.shouldRevalidate, false)
  assert.equal(result.reason, 'ignored-unrelated-entity')
})

test('resolveNotionWebhookRevalidation checks page parent data source when parent is not present in payload', async () => {
  const result = await resolveNotionWebhookRevalidation(
    {
      type: 'page.properties_updated',
      entity: {
        id: '153104cd-477e-809d-8dc4-ff2d96ae3090',
        type: 'page'
      },
      data: {
        parent: {
          id: '13950b26-c203-4f3b-b97d-93ec06319565',
          type: 'space'
        }
      }
    },
    {
      configuredDataSourceId: '15b104cd-477e-80c2-84a0-c32cefba5cff',
      resolvePageParentDataSourceId: async () => '15b104cd-477e-80c2-84a0-c32cefba5cff',
      resolvePagePath: async () => '/resolved-from-page-id'
    }
  )

  assert.equal(result.shouldRevalidate, true)
  assert.deepEqual(result.paths, ['/resolved-from-page-id'])
})
