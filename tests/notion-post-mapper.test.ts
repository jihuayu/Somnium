import assert from 'node:assert/strict'
import test from 'node:test'
import { mapPageToPost } from '../lib/notion/postMapper'

test('mapPageToPost throws when required Notion page metadata is missing', () => {
  assert.throws(
    () => mapPageToPost({
      id: 'page-1',
      created_time: '',
      last_edited_time: '2024-01-02T00:00:00.000Z',
      properties: {},
      parent: {
        type: 'data_source_id',
        data_source_id: 'source-1'
      }
    }),
    /missing created_time/
  )
})

test('mapPageToPost maps required page metadata into PostData', () => {
  const post = mapPageToPost({
    id: 'page-2',
    created_time: '2024-01-01T00:00:00.000Z',
    last_edited_time: '2024-01-02T00:00:00.000Z',
    parent: {
      type: 'data_source_id',
      data_source_id: 'source-1'
    },
    properties: {
      Title: {
        type: 'title',
        title: [{ plain_text: 'Post Title' }]
      },
      Slug: {
        type: 'rich_text',
        rich_text: [{ plain_text: 'post-title' }]
      },
      Summary: {
        type: 'rich_text',
        rich_text: [{ plain_text: 'Summary text' }]
      },
      Type: {
        type: 'select',
        select: { name: 'Post' }
      },
      Status: {
        type: 'status',
        status: { name: 'Published' }
      }
    }
  })

  assert.equal(post.id, 'page-2')
  assert.equal(post.title, 'Post Title')
  assert.equal(post.slug, 'post-title')
  assert.equal(post.summary, 'Summary text')
})