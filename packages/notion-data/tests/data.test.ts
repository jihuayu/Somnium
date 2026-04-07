import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPagePathFromPage,
  buildPagePreviewMap,
  createNotionPluginManager,
  queryAllDataSourceEntries,
  resolveNotionWebhookEvent,
  type NotionPageLike
} from '../src'

function createPage(): NotionPageLike {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    url: 'https://www.notion.so/example-page',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-02T00:00:00.000Z',
    parent: {
      type: 'data_source_id',
      data_source_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    },
    icon: {
      type: 'emoji',
      emoji: '📘'
    },
    properties: {
      title: {
        type: 'title',
        title: [{ plain_text: 'Guide' }]
      },
      slug: {
        type: 'rich_text',
        rich_text: [{ plain_text: 'guide' }]
      },
      summary: {
        type: 'rich_text',
        rich_text: [{ plain_text: 'Intro summary' }]
      },
      tags: {
        type: 'multi_select',
        multi_select: [{ name: 'Docs' }, { name: 'Guide' }]
      }
    }
  }
}

test('buildPagePathFromPage uses slug property and base path', () => {
  assert.equal(buildPagePathFromPage(createPage(), '/posts'), '/posts/guide')
})

test('buildPagePreviewMap builds preview records from render-layer href map', () => {
  const previewMap = buildPagePreviewMap([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Guide',
      summary: 'Intro summary'
    }
  ], {
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': '/posts/guide'
  }, {
    siteUrl: 'https://blog.jihuayu.com',
    buildImageUrl: id => `/og/${id}.png`
  })

  assert.deepEqual(previewMap['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'], {
    url: '/posts/guide',
    hostname: 'blog.jihuayu.com',
    title: 'Guide',
    description: 'Intro summary',
    image: '/og/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.png',
    icon: '/favicon.png'
  })
})

test('queryAllDataSourceEntries maps and sorts generic datasource pages', async () => {
  const pages = [createPage(), { ...createPage(), id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', properties: { ...createPage().properties, title: { type: 'title', title: [{ plain_text: 'Alpha' }] } } }]
  const client = {
    async queryAllDataSourcePages() {
      return pages
    }
  } as unknown as import('../src').NotionClient

  const entries = await queryAllDataSourceEntries<{ id: string, title: string }>(client, {
    dataSourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    mapPage: page => ({ id: page.id, title: page.properties.title?.title?.[0]?.plain_text || '' }),
    sortEntries: (left, right) => left.title.localeCompare(right.title)
  })

  assert.deepEqual(entries.map(item => item.title), ['Alpha', 'Guide'])
})

test('plugin manager can extend metadata and webhook resolution', async () => {
  const plugins = createNotionPluginManager([
    {
      name: 'test-plugin',
      extendPageMetadata: async () => ({ title: 'Patched', tags: ['Guide', 'Guide', 'Docs'] }),
      extendWebhookResolution: async () => ({ resolvedPagePath: '/patched' })
    }
  ])

  const metadata = await plugins.derivePageMetadata(createPage())
  assert.equal(metadata.title, 'Patched')
  assert.deepEqual(metadata.tags, ['Guide', 'Docs'])

  const resolution = await plugins.resolveWebhook({}, {
    accepted: true,
    shouldRefresh: true,
    isVerificationRequest: false,
    reason: 'refresh-page',
    eventType: 'page.content_updated',
    entityId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    action: 'page',
    resolvedPagePath: '/guide'
  })
  assert.equal(resolution.resolvedPagePath, '/patched')
})

test('resolveNotionWebhookEvent resolves page action for page updates', async () => {
  const resolution = await resolveNotionWebhookEvent({
    type: 'page.content_updated',
    entity: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    data: {
      parent: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        type: 'data_source_id'
      },
      properties: {
        slug: {
          type: 'rich_text',
          rich_text: [{ plain_text: 'guide' }]
        }
      }
    }
  }, {
    configuredDataSourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    basePath: '/posts'
  })

  assert.equal(resolution.action, 'page')
  assert.equal(resolution.shouldRefresh, true)
  assert.equal(resolution.resolvedPagePath, '/posts/guide')
})

test('resolveNotionWebhookEvent keeps page updates refreshable when path resolution is unavailable', async () => {
  const resolution = await resolveNotionWebhookEvent({
    type: 'page.content_updated',
    entity: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
    data: {
      parent: {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        type: 'data_source_id'
      }
    }
  }, {
    configuredDataSourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
  })

  assert.equal(resolution.action, 'page')
  assert.equal(resolution.shouldRefresh, true)
  assert.equal(resolution.reason, 'refresh-page-without-path')
  assert.equal(resolution.resolvedPagePath, '')
})