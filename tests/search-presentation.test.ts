import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SearchClient from '../components/SearchClient'
import Tags from '../components/Tags'

test('搜索具有页面标题、可提交表单和独立输入标签', () => {
  const html = renderToStaticMarkup(React.createElement(SearchClient, {
    tags: {},
    posts: [],
    blogPath: '',
    lang: 'zh-CN',
    useNotionSearch: true
  }))

  assert.match(html, /<h1[^>]*>搜索<\/h1>/)
  assert.match(html, /<form[^>]*role="search"/)
  assert.match(html, /<label[^>]*>搜索文章<\/label>/)
  assert.match(html, /type="submit"/)
  assert.match(html, /<input[^>]*disabled/)
  assert.match(html, /输入关键词，查找文章。/)
  assert.doesNotMatch(html, /Notion|Searching|No posts/)
})

test('切换标签保留关键词，所选标签有可访问的当前状态', () => {
  const html = renderToStaticMarkup(React.createElement(Tags, {
    tags: { 技术: 4, 影评: 4 },
    currentTag: '技术',
    query: 'RocksDB & Go'
  }))

  assert.match(html, /aria-label="按标签浏览"/)
  assert.match(html, /aria-current="page"/)
  assert.match(html, /\/search\?q=RocksDB\+%26\+Go/)
  assert.match(html, /\/tag\/%E5%BD%B1%E8%AF%84\?q=RocksDB\+%26\+Go/)
})
