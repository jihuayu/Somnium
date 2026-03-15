import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNotionDirectoryTree,
  buildNotionDirectoryTreeSnapshot,
  refreshNotionDirectoryTreeSnapshot,
  type NotionDirectoryPageLike
} from '../src/index'

const rootPageId = '11111111-1111-1111-1111-111111111111'
const childPageId = '22222222-2222-2222-2222-222222222222'
const siblingPageId = '33333333-3333-3333-3333-333333333333'

function createPage(
  id: string,
  {
    title,
    desc,
    tags = [],
    url,
    icon = '',
    parentId = ''
  }: {
    title: string
    desc?: string
    tags?: string[]
    url?: string
    icon?: string
    parentId?: string
  }
): NotionDirectoryPageLike {
  return {
    id,
    icon: icon ? { type: 'emoji', emoji: icon } : null,
    properties: {
      title: {
        type: 'title',
        title: [{ plain_text: title }]
      },
      desc: {
        type: 'rich_text',
        rich_text: desc ? [{ plain_text: desc }] : []
      },
      tag: {
        type: 'multi_select',
        multi_select: tags.map(name => ({ name }))
      },
      slug: {
        type: 'url',
        url: url || ''
      },
      parent: parentId
        ? {
            type: 'relation',
            relation: [{ id: parentId }]
          }
        : {
            type: 'relation',
            relation: []
          }
    }
  }
}

const buildOptions = {
  fieldNames: {
    desc: 'desc',
    tag: 'tag',
    url: 'slug',
    parent: 'parent'
  }
} as const

test('buildNotionDirectoryTree builds nested metadata tree for rendering', () => {
  const tree = buildNotionDirectoryTree([
    createPage(childPageId, {
      title: 'Child',
      desc: 'Nested child',
      tags: ['api'],
      url: '/docs/child',
      parentId: rootPageId
    }),
    createPage(rootPageId, {
      title: 'Root',
      desc: 'Root node',
      tags: ['guide'],
      url: '/docs/root',
      icon: '📚'
    }),
    createPage(siblingPageId, {
      title: 'Sibling',
      desc: 'Second root',
      tags: ['misc'],
      url: '/docs/sibling'
    })
  ], buildOptions)

  assert.equal(tree.length, 2)
  assert.equal(tree[0]?.title, 'Root')
  assert.equal(tree[0]?.desc, 'Root node')
  assert.deepEqual(tree[0]?.tag, ['guide'])
  assert.equal(tree[0]?.url, '/docs/root')
  assert.equal(tree[0]?.icon, '📚')
  assert.equal(tree[0]?.children.length, 1)
  assert.equal(tree[0]?.children[0]?.title, 'Child')
  assert.equal(tree[0]?.children[0]?.desc, 'Nested child')
  assert.deepEqual(tree[0]?.children[0]?.tag, ['api'])
})

test('refreshNotionDirectoryTreeSnapshot upserts moved pages from webhook payload', () => {
  const initialSnapshot = buildNotionDirectoryTreeSnapshot([
    createPage(rootPageId, {
      title: 'Root',
      url: '/docs/root'
    }),
    createPage(siblingPageId, {
      title: 'Sibling',
      url: '/docs/sibling'
    }),
    createPage(childPageId, {
      title: 'Child',
      url: '/docs/child',
      parentId: rootPageId
    })
  ], buildOptions)

  const result = refreshNotionDirectoryTreeSnapshot(initialSnapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.properties_updated',
      entity: {
        id: childPageId,
        type: 'page'
      }
    },
    page: createPage(childPageId, {
      title: 'Child Renamed',
      desc: 'Moved under sibling',
      url: '/docs/child-renamed',
      parentId: siblingPageId
    })
  }, buildOptions)

  assert.equal(result.changed, true)
  assert.equal(result.requiresFullRefresh, false)
  assert.equal(result.snapshot.nodesById[normalizeId(childPageId)]?.title, 'Child Renamed')
  assert.equal(result.snapshot.nodesById[normalizeId(siblingPageId)]?.children[0]?.id, normalizeId(childPageId))
  assert.equal(result.snapshot.nodesById[normalizeId(rootPageId)]?.children.length, 0)
})

test('refreshNotionDirectoryTreeSnapshot removes deleted pages from webhook payload', () => {
  const initialSnapshot = buildNotionDirectoryTreeSnapshot([
    createPage(rootPageId, {
      title: 'Root',
      url: '/docs/root'
    }),
    createPage(childPageId, {
      title: 'Child',
      url: '/docs/child',
      parentId: rootPageId
    })
  ], buildOptions)

  const result = refreshNotionDirectoryTreeSnapshot(initialSnapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.deleted',
      entity: {
        id: childPageId,
        type: 'page'
      }
    }
  }, buildOptions)

  assert.equal(result.changed, true)
  assert.equal(result.requiresFullRefresh, false)
  assert.equal(result.snapshot.nodesById[normalizeId(childPageId)], undefined)
  assert.equal(result.snapshot.nodesById[normalizeId(rootPageId)]?.children.length, 0)
})

test('refreshNotionDirectoryTreeSnapshot requests full refresh for container webhook events', () => {
  const initialSnapshot = buildNotionDirectoryTreeSnapshot([
    createPage(rootPageId, {
      title: 'Root',
      url: '/docs/root'
    })
  ], buildOptions)

  const result = refreshNotionDirectoryTreeSnapshot(initialSnapshot, {
    mode: 'webhook',
    payload: {
      type: 'data_source.schema_updated',
      entity: {
        id: '44444444-4444-4444-4444-444444444444',
        type: 'data_source'
      }
    }
  }, buildOptions)

  assert.equal(result.changed, false)
  assert.equal(result.requiresFullRefresh, true)
  assert.equal(result.reason, 'requires-full-refresh')
})

function normalizeId(value: string): string {
  return value.replaceAll('-', '').toLowerCase()
}