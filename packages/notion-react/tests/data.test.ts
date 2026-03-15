import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildPagePathFromPage,
  buildPagePreviewMap,
  createNotionPluginManager,
  queryAllDataSourceEntries,
  resolveNotionWebhookEvent,
  type NotionPageLike
} from '../src/data'

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
        multi_select: [{ name: 'docs' }]
      }
    }
  }
}

test('buildPagePathFromPage uses slug property and base path', () => {
  const path = buildPagePathFromPage(createPage(), '/docs')
  assert.equal(path, '/docs/guide')
})

test('buildPagePreviewMap builds preview records from render-layer href map', () => {
  const previewMap = buildPagePreviewMap([
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      title: 'Guide',
      summary: 'Intro summary'
    }
  ], {
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa': '/docs/guide'
  }, {
    siteUrl: 'https://blog.example.com',
    buildImageUrl: (pageId) => `https://blog.example.com/api/og/notion?pageId=${pageId}`
  })

  assert.deepEqual(previewMap['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'], {
    url: '/docs/guide',
    hostname: 'blog.example.com',
    title: 'Guide',
    description: 'Intro summary',
    image: 'https://blog.example.com/api/og/notion?pageId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    icon: '/favicon.png'
  })
})

test('queryAllDataSourceEntries maps and sorts generic datasource pages', async () => {
  const entries = await queryAllDataSourceEntries<{ id: string, title: string }>(
    {
      request: async <T>() => ({}) as T,
      retrieveDataSource: async () => ({}),
      retrievePage: async () => createPage(),
      queryDataSource: async () => ({ results: [], has_more: false, next_cursor: null }),
      queryAllDataSourcePages: async () => [
        createPage(),
        {
          ...createPage(),
          id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
          properties: {
            ...createPage().properties,
            title: {
              type: 'title',
              title: [{ plain_text: 'Alpha' }]
            }
          }
        }
      ],
      search: async () => ({ results: [], has_more: false, next_cursor: null }),
      listBlockChildren: async () => ({ results: [], has_more: false, next_cursor: null }),
      listAllBlockChildren: async () => []
    },
    {
      dataSourceId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      mapPage: (page) => ({
        id: page.id,
        title: page.properties.title?.title?.[0]?.plain_text || ''
      }),
      sortEntries: (left, right) => left.title.localeCompare(right.title, 'en')
    }
  )

  assert.deepEqual(entries.map(item => item.title), ['Alpha', 'Guide'])
})

test('plugin manager can extend metadata and webhook resolution', async () => {
  const manager = createNotionPluginManager([
    {
      name: 'docs-plugin',
      extendPageMetadata: async (_page, metadata) => ({
        tags: [...metadata.tags, 'plugin'],
        url: `/custom${metadata.url}`
      }),
      extendWebhookResolution: async (_payload, resolution) => ({
        reason: `${resolution.reason}:plugin`,
        resolvedPagePath: '/custom-refresh'
      })
    }
  ])

  const metadata = await manager.derivePageMetadata(createPage())
  assert.deepEqual(metadata.tags, ['docs', 'plugin'])
  assert.equal(metadata.url, '/custom/guide')

  const resolution = await manager.resolveWebhook({ type: 'page.created' }, await resolveNotionWebhookEvent({
    type: 'page.created',
    entity: { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', type: 'page' },
    data: {
      parent: { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', type: 'data_source' }
    }
  }))
  assert.equal(resolution.reason, 'refresh-home:plugin')
  assert.equal(resolution.resolvedPagePath, '/custom-refresh')
})