import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotionRenderer, type NotionRenderModel } from '../src/index'

const model: NotionRenderModel = {
  document: {
    pageId: 'page-1',
    rootIds: ['heading', 'heading-4', 'toggleable-heading', 'toggleable-heading-4', 'paragraph', 'code', 'tabs'],
    blocksById: {
      heading: {
        id: 'heading',
        type: 'heading_1',
        heading_1: { rich_text: [{ type: 'text', plain_text: 'Title' }] }
      },
      'heading-4': {
        id: 'heading-4',
        type: 'heading_4',
        heading_4: { rich_text: [{ type: 'text', plain_text: 'Detail' }] }
      },
      'toggleable-heading': {
        id: 'toggleable-heading',
        type: 'heading_2',
        has_children: true,
        heading_2: {
          rich_text: [{ type: 'text', plain_text: 'Foldable section' }],
          is_toggleable: true
        }
      },
      'toggleable-heading-body': {
        id: 'toggleable-heading-body',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Hidden until opened' }]
        }
      },
      'toggleable-heading-4': {
        id: 'toggleable-heading-4',
        type: 'heading_4',
        has_children: true,
        heading_4: {
          rich_text: [{ type: 'text', plain_text: 'Foldable H4' }],
          is_toggleable: true
        }
      },
      'toggleable-heading-4-body': {
        id: 'toggleable-heading-4-body',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'H4 hidden body' }]
        }
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
      'page-1': ['heading', 'heading-4', 'toggleable-heading', 'toggleable-heading-4', 'paragraph', 'code', 'tabs'],
      'toggleable-heading': ['toggleable-heading-body'],
      'toggleable-heading-4': ['toggleable-heading-4-body'],
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

const githubPreview = {
  url: 'https://github.com/jihuayu/Somnium',
  hostname: 'github.com',
  title: 'jihuayu/Somnium',
  description: 'A static blog build on top of Notion and NextJS, deployed on Vercel. - jihuayu/Somnium',
  image: 'https://opengraph.githubassets.com/hash/repo',
  icon: 'https://github.com/fluidicon.png'
}

test('NotionRenderer renders normalized model', () => {
  const html = renderToStaticMarkup(React.createElement(NotionRenderer, { model }))
  assert.match(html, /Title/)
  assert.match(html, /<h4[^>]*>.*Detail.*<\/h4>/)
  assert.match(html, /<details[^>]*id="notion-heading-toggleableheading"/)
  assert.match(html, /Foldable section/)
  assert.match(html, /Hidden until opened/)
  assert.match(html, /<h4[^>]*>.*Foldable H4.*<\/h4>/)
  assert.match(html, /H4 hidden body/)
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

test('in-page bookmark cards keep the original layout and ignore hover presentation', () => {
  const html = renderToStaticMarkup(React.createElement(NotionRenderer, {
    model: {
      document: {
        pageId: 'page-1',
        rootIds: ['bookmark', 'link-preview'],
        blocksById: {
          bookmark: {
            id: 'bookmark',
            type: 'bookmark',
            bookmark: { url: githubPreview.url }
          },
          'link-preview': {
            id: 'link-preview',
            type: 'link_preview',
            link_preview: { url: githubPreview.url }
          }
        },
        childrenById: {
          'page-1': ['bookmark', 'link-preview']
        }
      },
      toc: [],
      highlightedCodeByBlockId: {},
      linkPreviewMap: {
        [githubPreview.url]: githubPreview
      },
      pageHrefMap: {},
      pagePreviewMap: {}
    }
  }))

  assert.match(html, /data-link-preview-card="true"/)
  assert.match(html, /h-\[110px\]/)
  assert.match(html, /https:\/\/github.com\/jihuayu\/Somnium/)
  assert.equal((html.match(/data-link-preview-card="true"/g) || []).length, 2)
  assert.doesNotMatch(html, /github\.com · repo/)
  assert.doesNotMatch(html, /notion-url-mention-hover-card/)
  assert.doesNotMatch(html, /data-preview-kind/)
})

