import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareNotionRenderModel } from '../src/prepare'
import type { NotionDocument } from '../src/types'

const document: NotionDocument = {
  pageId: 'page-1',
  rootIds: ['h1', 'paragraph-1', 'code-1', 'code-2', 'bookmark-1', 'bookmark-2'],
  blocksById: {
    h1: {
      id: 'h1',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', plain_text: 'Hello Vue' }]
      }
    },
    'paragraph-1': {
      id: 'paragraph-1',
      type: 'paragraph',
      paragraph: {
        rich_text: [{
          type: 'text',
          plain_text: 'Internal page',
          text: {
            content: 'Internal page',
            link: {
              url: 'https://www.notion.so/workspace/Internal-Page-123456781234123412341234567890ab?pvs=4'
            }
          }
        }]
      }
    },
    'code-1': {
      id: 'code-1',
      type: 'code',
      code: {
        language: 'ts',
        rich_text: [{ type: 'text', plain_text: 'const x = 1' }]
      }
    },
    'code-2': {
      id: 'code-2',
      type: 'code',
      code: {
        language: 'typescript',
        rich_text: [{ type: 'text', plain_text: 'const x = 1' }]
      }
    },
    'bookmark-1': {
      id: 'bookmark-1',
      type: 'bookmark',
      bookmark: { url: 'https://example.com' }
    },
    'bookmark-2': {
      id: 'bookmark-2',
      type: 'bookmark',
      bookmark: { url: 'https://example.com' }
    }
  },
  childrenById: {
    'page-1': ['h1', 'paragraph-1', 'code-1', 'code-2', 'bookmark-1', 'bookmark-2']
  },
  toc: []
}

test('prepareNotionRenderModel deduplicates work and fills maps', async () => {
  let highlightCalls = 0
  let previewCalls = 0
  let pageHrefCalls = 0

  const model = await prepareNotionRenderModel(document, {
    highlightCode: async (source, language) => {
      highlightCalls += 1
      return {
        html: `<pre><code data-language="${language}">${source}</code></pre>`,
        displayLanguage: language
      }
    },
    resolveLinkPreview: async (url) => {
      previewCalls += 1
      return {
        url,
        hostname: 'example.com',
        title: 'Example',
        description: '',
        image: '',
        icon: ''
      }
    },
    resolvePageHref: async (id) => {
      pageHrefCalls += 1
      return id === '123456781234123412341234567890ab' ? '/posts/internal-page' : null
    },
    initialPagePreviewMap: {
      '123456781234123412341234567890ab': {
        url: '/posts/internal-page',
        hostname: 'blog.jihuayu.com',
        title: 'Internal Page',
        description: 'Preview body',
        image: 'https://blog.jihuayu.com/api/og/notion?pageId=123456781234123412341234567890ab',
        icon: '/favicon.png'
      }
    }
  })

  assert.ok(model)
  assert.equal(highlightCalls, 1)
  assert.equal(previewCalls, 1)
  assert.equal(pageHrefCalls, 1)
  assert.equal(model?.toc[0]?.text, 'Hello Vue')
  assert.equal(model?.pageHrefMap['123456781234123412341234567890ab'], '/posts/internal-page')
  assert.equal(model?.pagePreviewMap['123456781234123412341234567890ab']?.title, 'Internal Page')
})

test('prepareNotionRenderModel uses fallback behavior without resolvers', async () => {
  const model = await prepareNotionRenderModel(document, {
    initialLinkPreviewMap: {
      'https://example.com': {
        url: 'https://example.com',
        hostname: 'example.com',
        title: 'Example',
        description: '',
        image: '',
        icon: ''
      }
    }
  })

  assert.ok(model)
  assert.equal(model?.highlightedCodeByBlockId['code-1']?.language, 'typescript')
  assert.match(model?.highlightedCodeByBlockId['code-1']?.html || '', /<pre/)
  assert.equal(model?.linkPreviewMap['https://example.com']?.hostname, 'example.com')
  assert.equal(model?.pageHrefMap['123456781234123412341234567890ab'], 'https://www.notion.so/123456781234123412341234567890ab')
})
