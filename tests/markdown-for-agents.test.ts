import assert from 'node:assert/strict'
import test from 'node:test'
import { toMarkdownBlockquote } from '../lib/server/markdownForAgents'

test('toMarkdownBlockquote prefixes every line with >', () => {
  const input = [
    '这个项目要用哪个版本的 JDK 或 Node.js？',
    '应该进入哪个目录？',
    '使用什么命令启动？'
  ].join('\n')

  assert.equal(
    toMarkdownBlockquote(input),
    [
      '> 这个项目要用哪个版本的 JDK 或 Node.js？',
      '> 应该进入哪个目录？',
      '> 使用什么命令启动？'
    ].join('\n')
  )
})

test('toMarkdownBlockquote keeps blank lines inside the quote', () => {
  assert.equal(
    toMarkdownBlockquote('line one\n\nline three'),
    '> line one\n> \n> line three'
  )
})

test('toMarkdownBlockquote returns a single empty quote line for empty content', () => {
  assert.equal(toMarkdownBlockquote(''), '> ')
})
