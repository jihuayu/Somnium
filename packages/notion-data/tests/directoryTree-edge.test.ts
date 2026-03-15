import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildNotionDirectoryTreeSnapshot,
  refreshNotionDirectoryTreeSnapshot,
  type NotionDirectoryPageLike
} from '../src'

function createPage(id: string, title: string, parentId = '', url = ''): NotionDirectoryPageLike {
  return {
    id,
    url,
    icon: { type: 'emoji', emoji: '📄' },
    properties: {
      Name: {
        type: 'title',
        title: [{ plain_text: title }]
      },
      Parent: parentId
        ? {
            type: 'relation',
            relation: [{ id: parentId }]
          }
        : undefined,
      Url: url
        ? {
            type: 'url',
            url
          }
        : undefined,
      Tags: {
        type: 'multi_select',
        multi_select: [{ name: 'Docs' }, { name: 'Docs' }, { name: 'Guide' }]
      }
    }
  }
}

test('directory tree supports custom field names and relation cycle fallback', () => {
  const a = createPage('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '/a')
  const b = createPage('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '/b')

  const snapshot = buildNotionDirectoryTreeSnapshot([a, b], {
    fieldNames: {
      title: ['Name'],
      parent: ['Parent'],
      url: ['Url'],
      tag: ['Tags']
    }
  })

  assert.equal(snapshot.roots.length, 2)
  assert.deepEqual(snapshot.entriesById['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'].tag, ['Docs', 'Guide'])
})

test('directory tree refresh handles webhook edge reasons', () => {
  const rootId = '11111111-1111-1111-1111-111111111111'
  const snapshot = buildNotionDirectoryTreeSnapshot([createPage(rootId, 'Root', '', '/root')])

  const verification = refreshNotionDirectoryTreeSnapshot(snapshot, {
    mode: 'webhook',
    payload: {
      verification_token: 'token'
    }
  })
  assert.equal(verification.reason, 'verification')

  const missingType = refreshNotionDirectoryTreeSnapshot(snapshot, {
    mode: 'webhook',
    payload: {}
  })
  assert.equal(missingType.reason, 'missing-event-type')

  const noopDelete = refreshNotionDirectoryTreeSnapshot(snapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.deleted',
      entity: { id: '22222222-2222-2222-2222-222222222222' }
    }
  })
  assert.equal(noopDelete.reason, 'noop-delete')

  const ignoredPage = refreshNotionDirectoryTreeSnapshot(snapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.archived',
      entity: { id: rootId }
    }
  })
  assert.equal(ignoredPage.reason, 'ignored-page-event')

  const missingPagePayload = refreshNotionDirectoryTreeSnapshot(snapshot, {
    mode: 'webhook',
    payload: {
      type: 'page.moved',
      entity: { id: rootId }
    }
  })
  assert.equal(missingPagePayload.reason, 'missing-page-payload')

  const full = refreshNotionDirectoryTreeSnapshot(snapshot, {
    mode: 'full',
    pages: [createPage(rootId, 'Root v2', '', '/root-v2')]
  })
  assert.equal(full.reason, 'full-refresh')
  assert.equal(full.changed, true)
  assert.equal(full.snapshot.roots[0].url, '/root-v2')
})
