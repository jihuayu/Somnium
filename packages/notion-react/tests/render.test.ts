import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotionRenderer, type NotionRenderModel } from '../src/index'

const model: NotionRenderModel = {
  document: {
    pageId: 'page-1',
    rootIds: ['heading', 'paragraph', 'code', 'tabs'],
    blocksById: {
      heading: {
        id: 'heading',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', plain_text: 'Title' }] }
      },
      paragraph: {
        id: 'paragraph',
        type: 'paragraph',
        paragraph: {
          rich_text: [
            { type: 'text', plain_text: 'Body ' },
            {
              type: 'text',
              plain_text: 'Internal',
              text: {
                content: 'Internal',
                link: {
                  url: 'https://www.notion.so/Internal-123456781234123412341234567890ab'
                }
              }
            }
          ]
        }
      },
      code: {
        id: 'code',
        type: 'code',
        code: { language: 'ts', rich_text: [{ type: 'text', plain_text: 'const x = 1' }] }
      },
      tabs: {
        id: 'tabs',
        type: 'tab',
        tab: {}
      },
      'tab-panel-1': {
        id: 'tab-panel-1',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Overview' }],
          icon: { type: 'emoji', emoji: '😉' }
        }
      },
      'tab-panel-1-body': {
        id: 'tab-panel-1-body',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Tabbed content' }]
        }
      },
      'tab-panel-2': {
        id: 'tab-panel-2',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Details' }]
        }
      },
      'tab-panel-2-body': {
        id: 'tab-panel-2-body',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Second tab body' }]
        }
      },
      'tab-panel-empty': {
        id: 'tab-panel-empty',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Empty tab' }]
        }
      }
    },
    childrenById: {
      'page-1': ['heading', 'paragraph', 'code', 'tabs'],
      tabs: ['tab-panel-1', 'tab-panel-2', 'tab-panel-empty'],
      'tab-panel-1': ['tab-panel-1-body'],
      'tab-panel-2': ['tab-panel-2-body']
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
  pageHrefMap: {
    '123456781234123412341234567890ab': '/posts/internal'
  },
  pagePreviewMap: {
    '123456781234123412341234567890ab': {
      url: '/posts/internal',
      hostname: 'blog.jihuayu.com',
      title: 'Internal',
      description: 'Internal page preview',
      image: 'https://blog.jihuayu.com/api/og/notion?pageId=123456781234123412341234567890ab',
      icon: '/favicon.svg'
    }
  }
}

test('NotionRenderer renders normalized model', () => {
  const html = renderToStaticMarkup(React.createElement(NotionRenderer, { model }))
  assert.match(html, /Title/)
  assert.match(html, /Body/)
  assert.match(html, /TypeScript/)
  assert.match(html, /href="\/posts\/internal"/)
  assert.doesNotMatch(html, /href="\/posts\/internal"[^>]*target="_blank"/)
  assert.match(html, /notion-url-mention-inline/)
  assert.match(html, /notion-tabs-block/)
  assert.match(html, /Overview/)
  assert.match(html, /Tabbed content/)
  assert.match(html, /Second tab body/)
  assert.doesNotMatch(html, /Empty tab/)
})
