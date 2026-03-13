import test from 'node:test'
import assert from 'node:assert/strict'
import { generateRssFeed, renderNotionDocumentToHtml } from '../src/rss'
import type { NotionDocument } from '../src/types'

const document: NotionDocument = {
  pageId: 'page-1',
  rootIds: ['heading-1', 'paragraph-1', 'bulleted-1', 'bulleted-2'],
  blocksById: {
    'heading-1': {
      id: 'heading-1',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', plain_text: 'RSS Title' }]
      }
    },
    'paragraph-1': {
      id: 'paragraph-1',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', plain_text: 'RSS Body' }]
      }
    },
    'bulleted-1': {
      id: 'bulleted-1',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', plain_text: 'First' }]
      }
    },
    'bulleted-2': {
      id: 'bulleted-2',
      type: 'bulleted_list_item',
      bulleted_list_item: {
        rich_text: [{ type: 'text', plain_text: 'Second' }]
      }
    }
  },
  childrenById: {
    'page-1': ['heading-1', 'paragraph-1', 'bulleted-1', 'bulleted-2']
  },
  toc: []
}

test('renderNotionDocumentToHtml renders grouped list blocks', () => {
  const html = renderNotionDocumentToHtml(document)
  assert.match(html, /<h1>RSS Title<\/h1>/)
  assert.match(html, /<p>RSS Body<\/p>/)
  assert.match(html, /<ul><li>First<\/li><li>Second<\/li><\/ul>/)
})

test('generateRssFeed renders rss xml from notion documents', () => {
  const xml = generateRssFeed({
    title: 'Demo Feed',
    description: 'Feed Description',
    siteUrl: 'https://blog.jihuayu.com',
    items: [
      {
        title: 'Hello',
        link: '/hello',
        date: '2026-03-13T00:00:00.000Z',
        document
      }
    ]
  })

  assert.match(xml, /<title>Demo Feed<\/title>/)
  assert.match(xml, /<title><!\[CDATA\[Hello\]\]><\/title>/)
  assert.match(xml, /RSS Body/)
})
