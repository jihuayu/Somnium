import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareNotionRenderModel, type NotionDocument } from '../src/index'

const document: NotionDocument = {
  pageId: 'page-1',
  rootIds: ['h1', 'code-1', 'code-2', 'bookmark-1', 'bookmark-2'],
  blocksById: {
    h1: {
      id: 'h1',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', plain_text: 'Hello' }]
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
    'page-1': ['h1', 'code-1', 'code-2', 'bookmark-1', 'bookmark-2']
  }
}

test('prepareNotionRenderModel deduplicates highlight and link preview work and fills toc', async () => {
  let highlightCalls = 0
  let previewCalls = 0

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
    }
  })

  assert.ok(model)
  assert.equal(highlightCalls, 1)
  assert.equal(previewCalls, 1)
  assert.equal(model?.toc[0]?.text, 'Hello')
})
