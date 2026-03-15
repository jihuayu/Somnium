import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNotionDirectoryTree,
  buildNotionDirectoryTreeSnapshot,
  refreshNotionDirectoryTreeSnapshot,
  type NotionDirectoryPageLike
} from '../src'

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
    properties: {
      title: {
        type: 'title',
        title: [{ plain_text: title }]
      },
      desc: desc
        ? {
            type: 'rich_text',
            rich_text: [{ plain_text: desc }]
          }
        : undefined,
      tags: tags.length
        ? {
            type: 'multi_select',
            multi_select: tags.map(name => ({ name }))
          }
        : undefined,
      url: url
        ? {
            type: 'url',
            url
          }
        : undefined,
      icon: icon
        ? {
            type: 'rich_text',
            rich_text: [{ plain_text: icon }]
          }
        : undefined,
      parent: parentId
        ? {
            type: 'relation',
            relation: [{ id: parentId }]
          }
        : undefined
    }
  }
}

test('buildNotionDirectoryTree builds nested metadata tree for rendering', () => {
  const tree = buildNotionDirectoryTree([
    createPage(rootPageId, { title: 'Root', desc: 'Root desc', tags: ['Docs'], url: '/root', icon: '📘' }),
    createPage(childPageId, { title: 'Child', desc: 'Child desc', tags: ['Guide'], url: '/child', parentId: rootPageId }),
    createPage(siblingPageId, { title: 'Sibling', desc: 'Sibling desc', tags: ['Ref'], url: '/sibling' })
  ])

  assert.equal(tree.length, 2)
  assert.equal(tree[0].title, 'Root')
  assert.equal(tree[0].children[0].title, 'Child')
  assert.deepEqual(tree[0].tag, ['Docs'])
  assert.equal(tree[0].icon, '📘')
})

test('refreshNotionDirectoryTreeSnapshot upserts moved pages from webhook payload', () => {
  const currentSnapshot = buildNotionDirectoryTreeSnapshot([
    createPage(rootPageId, { title: 'Root', url: '/root' }),
    createPage(childPageId, { title: 'Child', url: '/child' })
  ])

  const result = refreshNotionDirectoryTreeSnapshot(currentSnapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.moved',
      entity: { id: childPageId }
    },
    page: createPage(childPageId, { title: 'Child', url: '/child', parentId: rootPageId })
  })

  assert.equal(result.changed, true)
  assert.equal(result.reason, 'page-upserted')
  assert.equal(result.snapshot.roots[0].children[0].title, 'Child')
})

test('refreshNotionDirectoryTreeSnapshot removes deleted pages from webhook payload', () => {
  const currentSnapshot = buildNotionDirectoryTreeSnapshot([
    createPage(rootPageId, { title: 'Root', url: '/root' }),
    createPage(childPageId, { title: 'Child', url: '/child', parentId: rootPageId })
  ])

  const result = refreshNotionDirectoryTreeSnapshot(currentSnapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.deleted',
      entity: { id: childPageId }
    }
  })

  assert.equal(result.changed, true)
  assert.equal(result.snapshot.roots[0].children.length, 0)
})

test('refreshNotionDirectoryTreeSnapshot requests full refresh for container webhook events', () => {
  const currentSnapshot = buildNotionDirectoryTreeSnapshot([
    createPage(rootPageId, { title: 'Root', url: '/root' })
  ])

  const result = refreshNotionDirectoryTreeSnapshot(currentSnapshot, {
    mode: 'webhook',
    payload: {
      type: 'data_source.schema_updated',
      entity: { id: '44444444-4444-4444-4444-444444444444' }
    }
  })

  assert.equal(result.changed, false)
  assert.equal(result.requiresFullRefresh, true)
})