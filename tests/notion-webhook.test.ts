import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeNotionWebhookSignature,
  isNotionVerificationRequest,
  isValidNotionWebhookSignature,
  resolveNotionWebhookEvent
} from '@jihuayu/notion-react/data'

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

test('resolveNotionWebhookEvent accepts verification payloads without refresh', async () => {
  const result = await resolveNotionWebhookEvent({
    verification_token: 'secret_123'
  })

  assert.equal(result.accepted, true)
  assert.equal(result.isVerificationRequest, true)
  assert.equal(result.shouldRefresh, false)
  assert.equal(result.action, 'verification')
})

test('resolveNotionWebhookEvent resolves schema action for matching data source events', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, true)
  assert.equal(result.action, 'schema')
})

test('resolveNotionWebhookEvent resolves page action for page updates', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, true)
  assert.equal(result.action, 'page')
  assert.equal(result.resolvedPagePath, '/gpt-might-be-an-information-virus')
})

test('resolveNotionWebhookEvent resolves home action for page creation', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, true)
  assert.equal(result.action, 'home')
})

test('resolveNotionWebhookEvent resolves home-and-page action for page deletion', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, true)
  assert.equal(result.action, 'home-and-page')
  assert.equal(result.resolvedPagePath, '/deleted-post')
})

test('resolveNotionWebhookEvent ignores container content events', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, false)
  assert.equal(result.reason, 'ignored-container-content-event')
  assert.equal(result.action, 'ignore')
})

test('resolveNotionWebhookEvent ignores unrelated data sources', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, false)
  assert.equal(result.reason, 'ignored-unrelated-entity')
  assert.equal(result.action, 'ignore')
})

test('resolveNotionWebhookEvent checks page parent data source when parent is not present in payload', async () => {
  const result = await resolveNotionWebhookEvent(
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

  assert.equal(result.shouldRefresh, true)
  assert.equal(result.action, 'page')
  assert.equal(result.resolvedPagePath, '/resolved-from-page-id')
})
