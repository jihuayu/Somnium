import assert from 'node:assert/strict'
import test from 'node:test'
import { groupPostsByYear, resolveRelatedPosts, shouldShowTableOfContents } from '../lib/postNavigation'
import type { PostData } from '../lib/notion/filterPublishedPosts'

function post(slug: string, date: string, overrides: Partial<PostData> = {}): PostData {
  return {
    id: slug,
    title: slug,
    slug,
    date: new Date(date).valueOf(),
    summary: '',
    tags: [],
    formats: [],
    type: ['Post'],
    status: ['Published'],
    fullWidth: false,
    ...overrides
  }
}

test('年份目录按博客时区归组并倒序排列，完整保留文章且不改变首页原顺序', () => {
  const posts = [
    post('older', '2024-06-01T00:00:00Z'),
    post('new-year', '2024-12-31T18:00:00Z'),
    post('newer', '2025-05-01T00:00:00Z')
  ]
  const groups = groupPostsByYear(posts, 'Asia/Shanghai')
  assert.deepEqual(groups.map(group => [group.year, group.posts.map(item => item.slug)]), [
    ['2025', ['newer', 'new-year']],
    ['2024', ['older']]
  ])
  assert.deepEqual(posts.map(item => item.slug), ['older', 'new-year', 'newer'])
  assert.deepEqual(groupPostsByYear([], 'Asia/Shanghai'), [])
})

test('目录统计主要小标题，深层小标题不会让短文章显示目录，作者可覆盖', () => {
  const primary = Array.from({ length: 3 }, (_, index) => ({ id: `main-${index}`, text: '主标题', indentLevel: 1 }))
  const nested = Array.from({ length: 6 }, (_, index) => ({ id: `sub-${index}`, text: '次级标题', indentLevel: 2 }))
  assert.equal(shouldShowTableOfContents([...primary, ...nested]), false)
  assert.equal(shouldShowTableOfContents([...primary, ...nested], true), true)
  const longArticle = [...primary, { id: 'fourth', text: '第四节', indentLevel: 1 }]
  assert.equal(shouldShowTableOfContents(longArticle), true)
  assert.equal(shouldShowTableOfContents(longArticle, false), false)
  assert.equal(shouldShowTableOfContents([], true), false)
})

test('上下文链接只使用明确配置的已发布文章，排除自身、缺失、重复和未发布条目，至多两条', () => {
  const posts = [
    post('self', '2026-01-01'),
    post('follow-up', '2026-02-01'),
    post('earlier', '2025-01-01'),
    post('third', '2025-02-01'),
    post('draft', '2026-02-01', { status: ['Draft'] }),
    post('future', '2099-01-01'),
    post('about', '2025-01-01', { type: ['Page'] })
  ]
  const references = ['self', 'missing', 'draft', 'future', 'about', 'follow-up', 'follow-up', 'earlier', 'third']
    .map(slug => ({ slug, label: `阅读 ${slug}` }))
  assert.deepEqual(resolveRelatedPosts('self', references, posts, '/blog'), [
    { href: '/blog/follow-up', label: '阅读 follow-up', title: 'follow-up' },
    { href: '/blog/earlier', label: '阅读 earlier', title: 'earlier' }
  ])
  assert.deepEqual(resolveRelatedPosts('self', [], posts), [])
})
