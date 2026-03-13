import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotionRenderer, type NotionRenderModel } from '../src/index'

const model: NotionRenderModel = {
  document: {
    pageId: 'page-1',
    rootIds: ['heading', 'paragraph', 'code'],
    blocksById: {
      heading: {
        id: 'heading',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', plain_text: 'Title' }] }
      },
      paragraph: {
        id: 'paragraph',
        type: 'paragraph',
        paragraph: { rich_text: [{ type: 'text', plain_text: 'Body' }] }
      },
      code: {
        id: 'code',
        type: 'code',
        code: { language: 'ts', rich_text: [{ type: 'text', plain_text: 'const x = 1' }] }
      }
    },
    childrenById: {
      'page-1': ['heading', 'paragraph', 'code']
    },
    toc: [{ id: 'heading', text: 'Title', indentLevel: 0 }]
  },
  toc: [{ id: 'heading', text: 'Title', indentLevel: 0 }],
  highlightedCodeByBlockId: {
    code: {
      html: '<pre><code>const x = 1</code></pre>',
      language: 'typescript',
      displayLanguage: 'TypeScript'
    }
  },
  linkPreviewMap: {},
  pageHrefMap: {}
}

test('NotionRenderer renders normalized model', () => {
  const html = renderToStaticMarkup(React.createElement(NotionRenderer, { model }))
  assert.match(html, /Title/)
  assert.match(html, /Body/)
  assert.match(html, /TypeScript/)
})
