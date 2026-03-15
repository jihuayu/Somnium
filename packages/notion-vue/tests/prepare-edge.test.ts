import test from 'node:test'
import assert from 'node:assert/strict'
import { prepareNotionRenderModel } from '../src/prepare'
import type { NotionDocument } from '../src/types'

const edgeDocument: NotionDocument = {
  pageId: 'root-page',
  rootIds: ['code-mermaid', 'bookmark-1', 'link-to-page'],
  blocksById: {
    'code-mermaid': {
      id: 'code-mermaid',
      type: 'code',
      code: {
        language: 'mermaid',
        rich_text: [{ type: 'text', plain_text: 'graph TD;A-->B;' }]
      }
    },
    'bookmark-1': {
      id: 'bookmark-1',
      type: 'bookmark',
      bookmark: { url: 'https://cards.example.com/preview' }
    },
    'link-to-page': {
      id: 'link-to-page',
      type: 'link_to_page',
      link_to_page: {
        type: 'page_id',
        page_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      }
    }
  },
  childrenById: {
    'root-page': ['code-mermaid', 'bookmark-1', 'link-to-page']
  },
  toc: []
}

test('vue prepareNotionRenderModel handles null and resolver failures', async () => {
  const nullResult = await prepareNotionRenderModel(null)
  assert.equal(nullResult, null)

  const model = await prepareNotionRenderModel(edgeDocument, {
    resolveLinkPreview: async () => {
      throw new Error('network')
    },
    resolvePageHref: async () => {
      throw new Error('resolver')
    }
  })

  assert.ok(model)
  assert.equal(model?.highlightedCodeByBlockId['code-mermaid'], undefined)
  assert.equal(model?.linkPreviewMap['https://cards.example.com/preview'], undefined)
  assert.equal(model?.pageHrefMap['aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'], 'https://www.notion.so/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
})
