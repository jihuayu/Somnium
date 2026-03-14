import type { NotionRenderModel, NotionRichText } from '../src'

const linkedPageId = '11111111111111111111111111111111'

export const demoRichText: NotionRichText[] = [
  { type: 'text', plain_text: 'Read the ', text: { content: 'Read the ' } },
  {
    type: 'mention',
    plain_text: 'GitHub repo',
    mention: {
      type: 'link_mention',
      link_mention: {
        href: 'https://github.com/jihuayu/somnium',
        title: 'somnium',
        description: 'Nobelium-based blog project',
        icon_url: 'https://github.githubassets.com/favicons/favicon.svg',
        thumbnail_url: 'https://placehold.co/640x360/png?text=GitHub',
        link_provider: 'GitHub'
      }
    }
  },
  { type: 'text', plain_text: ' and check the ', text: { content: ' and check the ' } },
  {
    type: 'mention',
    plain_text: 'launch date',
    mention: {
      type: 'date',
      date: {
        start: '2026-03-01T09:00:00+08:00'
      }
    }
  },
  { type: 'text', plain_text: '.', text: { content: '.' } }
]

export const demoModel: NotionRenderModel = {
  document: {
    pageId: 'page-1',
    rootIds: [
      'toc-1',
      'heading-1',
      'paragraph-1',
      'callout-1',
      'bookmark-1',
      'code-1',
      'toggle-1',
      'bulleted-1',
      'bulleted-2',
      'table-1',
      'image-1',
      'link-page-1'
    ],
    blocksById: {
      'toc-1': { id: 'toc-1', type: 'table_of_contents' },
      'heading-1': {
        id: 'heading-1',
        type: 'heading_1',
        heading_1: {
          rich_text: [{ type: 'text', plain_text: 'Library Demo', text: { content: 'Library Demo' } }]
        }
      },
      'paragraph-1': {
        id: 'paragraph-1',
        type: 'paragraph',
        paragraph: { rich_text: demoRichText }
      },
      'callout-1': {
        id: 'callout-1',
        type: 'callout',
        callout: {
          icon: { type: 'emoji', emoji: '!' },
          rich_text: [{ type: 'text', plain_text: 'Tailwind classes are applied inside the renderer.', text: { content: 'Tailwind classes are applied inside the renderer.' } }]
        }
      },
      'bookmark-1': {
        id: 'bookmark-1',
        type: 'bookmark',
        bookmark: {
          url: 'https://storybook.js.org/docs',
          caption: [{ type: 'text', plain_text: 'Storybook preview card', text: { content: 'Storybook preview card' } }]
        }
      },
      'code-1': {
        id: 'code-1',
        type: 'code',
        code: {
          language: 'ts',
          rich_text: [{ type: 'text', plain_text: 'export const title = "notion-react"', text: { content: 'export const title = "notion-react"' } }]
        }
      },
      'toggle-1': {
        id: 'toggle-1',
        type: 'toggle',
        toggle: {
          rich_text: [{ type: 'text', plain_text: 'Open nested content', text: { content: 'Open nested content' } }]
        },
        has_children: true
      },
      'toggle-paragraph-1': {
        id: 'toggle-paragraph-1',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', plain_text: 'Nested paragraph content for the toggle block.', text: { content: 'Nested paragraph content for the toggle block.' } }]
        }
      },
      'bulleted-1': {
        id: 'bulleted-1',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', plain_text: 'Grouped list item A', text: { content: 'Grouped list item A' } }]
        }
      },
      'bulleted-2': {
        id: 'bulleted-2',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', plain_text: 'Grouped list item B', text: { content: 'Grouped list item B' } }]
        }
      },
      'table-1': {
        id: 'table-1',
        type: 'table',
        table: {
          table_width: 2,
          has_column_header: true,
          has_row_header: false
        },
        has_children: true
      },
      'table-row-1': {
        id: 'table-row-1',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', plain_text: 'Name', text: { content: 'Name' } }],
            [{ type: 'text', plain_text: 'Value', text: { content: 'Value' } }]
          ]
        }
      },
      'table-row-2': {
        id: 'table-row-2',
        type: 'table_row',
        table_row: {
          cells: [
            [{ type: 'text', plain_text: 'Package', text: { content: 'Package' } }],
            [{ type: 'text', plain_text: '@jihuayu/notion-react', text: { content: '@jihuayu/notion-react' } }]
          ]
        }
      },
      'image-1': {
        id: 'image-1',
        type: 'image',
        image: {
          type: 'external',
          external: { url: 'https://placehold.co/1200x720/png?text=Notion+React' },
          caption: [{ type: 'text', plain_text: 'Responsive external image', text: { content: 'Responsive external image' } }]
        }
      },
      'link-page-1': {
        id: 'link-page-1',
        type: 'link_to_page',
        link_to_page: {
          type: 'page_id',
          page_id: linkedPageId
        }
      }
    },
    childrenById: {
      'page-1': [
        'toc-1',
        'heading-1',
        'paragraph-1',
        'callout-1',
        'bookmark-1',
        'code-1',
        'toggle-1',
        'bulleted-1',
        'bulleted-2',
        'table-1',
        'image-1',
        'link-page-1'
      ],
      'toggle-1': ['toggle-paragraph-1'],
      'table-1': ['table-row-1', 'table-row-2']
    },
    toc: [
      { id: 'heading-1', text: 'Library Demo', indentLevel: 0 }
    ]
  },
  toc: [
    { id: 'heading-1', text: 'Library Demo', indentLevel: 0 }
  ],
  highlightedCodeByBlockId: {
    'code-1': {
      html: '<pre class="shiki"><code><span style="color:#0f172a">export const title = &quot;notion-react&quot;</span></code></pre>',
      language: 'typescript',
      displayLanguage: 'TypeScript'
    }
  },
  linkPreviewMap: {
    'https://storybook.js.org/docs': {
      url: 'https://storybook.js.org/docs',
      hostname: 'storybook.js.org',
      title: 'Storybook Docs',
      description: 'Build component libraries and document them in isolation.',
      image: 'https://placehold.co/640x360/png?text=Storybook',
      icon: 'https://storybook.js.org/icon.svg'
    }
  },
  pageHrefMap: {
    [linkedPageId]: '/posts/notion-react'
  },
  pagePreviewMap: {
    [linkedPageId]: {
      url: '/posts/notion-react',
      hostname: 'blog.jihuayu.com',
      title: 'notion-react',
      description: 'Workspace package preview',
      image: 'https://blog.jihuayu.com/api/og/notion?pageId=11111111111111111111111111111111',
      icon: '/favicon.svg'
    }
  }
}
