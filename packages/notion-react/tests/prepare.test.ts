import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareNotionRenderModel, type NotionDocument } from '../src/index'

const document: NotionDocument = {
  pageId: 'page-1',
  rootIds: ['h1', 'paragraph-1', 'code-1', 'code-2', 'bookmark-1', 'bookmark-2'],
  blocksById: {
    h1: {
      id: 'h1',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', plain_text: 'Hello' }]
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
  }
}

test('prepareNotionRenderModel deduplicates highlight and link preview work and fills toc', async () => {
  let highlightCalls = 0
  let previewCalls = 0
  let pageHrefCalls = 0
  let pagePreviewCalls = 0

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
    resolvePagePreview: async (id) => {
      pagePreviewCalls += 1
      return id === '123456781234123412341234567890ab'
        ? {
            url: '/posts/internal-page',
            hostname: 'blog.jihuayu.com',
            title: 'Internal Page',
            description: 'Preview body',
            image: 'https://blog.jihuayu.com/api/og/notion?pageId=123456781234123412341234567890ab',
            icon: '/favicon.svg'
          }
        : null
    }
  })

  assert.ok(model)
  assert.equal(highlightCalls, 1)
  assert.equal(previewCalls, 1)
  assert.equal(pageHrefCalls, 1)
  assert.equal(pagePreviewCalls, 1)
  assert.equal(model?.toc[0]?.text, 'Hello')
  assert.equal(model?.pageHrefMap['123456781234123412341234567890ab'], '/posts/internal-page')
  assert.equal(model?.pagePreviewMap['123456781234123412341234567890ab']?.image, 'https://blog.jihuayu.com/api/og/notion?pageId=123456781234123412341234567890ab')
})
