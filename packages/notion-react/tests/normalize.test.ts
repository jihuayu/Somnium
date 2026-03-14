import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeNotionDocument } from '../src/normalize'

test('normalizeNotionDocument converts raw notion block collections into a normalized document', () => {
  const document = normalizeNotionDocument({
    pageId: 'page-1',
    childBlocksByParentId: {
      'page-1': [
        {
          id: 'heading-1',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', plain_text: 'Title' }]
          }
        },
        {
          id: 'toggle-1',
          type: 'toggle',
          has_children: true,
          toggle: {
            rich_text: [{ type: 'text', plain_text: 'More' }]
          }
        }
      ],
      'toggle-1': [
        {
          id: 'paragraph-1',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', plain_text: 'Nested body' }]
          }
        }
      ]
    }
  })

  assert.deepEqual(document.rootIds, ['heading-1', 'toggle-1'])
  assert.deepEqual(document.childrenById['toggle-1'], ['paragraph-1'])
  assert.equal(document.toc?.[0]?.text, 'Title')
})

test('normalizeNotionDocument also supports nested children arrays', () => {
  const document = normalizeNotionDocument({
    pageId: 'page-2',
    rootBlocks: [
      {
        id: 'toggle-2',
        type: 'toggle',
        has_children: true,
        toggle: {
          rich_text: [{ type: 'text', plain_text: 'Nested' }]
        },
        children: [
          {
            id: 'paragraph-2',
            type: 'paragraph',
            paragraph: {
              rich_text: [{ type: 'text', plain_text: 'Body' }]
            }
          }
        ]
      }
    ]
  })

  assert.deepEqual(document.rootIds, ['toggle-2'])
  assert.deepEqual(document.childrenById['toggle-2'], ['paragraph-2'])
  assert.equal(document.blocksById['paragraph-2']?.type, 'paragraph')
})

test('normalizeNotionDocument coerces unknown block types into unsupported blocks', () => {
  const document = normalizeNotionDocument({
    pageId: 'page-3',
    rootBlocks: [
      {
        id: 'custom-1',
        type: 'custom_widget',
        has_children: false
      }
    ]
  })

  assert.equal(document.blocksById['custom-1']?.type, 'unsupported')
  assert.equal(document.blocksById['custom-1']?.unsupported?.originalType, 'custom_widget')
})

test('normalizeNotionDocument coerces invalid known block payloads into unsupported blocks', () => {
  const document = normalizeNotionDocument({
    pageId: 'page-4',
    rootBlocks: [
      {
        id: 'bookmark-invalid',
        type: 'bookmark',
        bookmark: {}
      }
    ]
  })

  assert.equal(document.blocksById['bookmark-invalid']?.type, 'unsupported')
  assert.equal(document.blocksById['bookmark-invalid']?.unsupported?.originalType, 'bookmark')
})
