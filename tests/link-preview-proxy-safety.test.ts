import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isLinkPreviewImageWhitelisted,
  resolveLinkPreviewImageProxy
} from '../lib/server/linkPreviewImageProxy'

test('resolveLinkPreviewImageProxy only allows whitelisted douban hosts', () => {
  const allowed = resolveLinkPreviewImageProxy('https://img3.doubanio.com/view/subject/l/public/s35172637.jpg')
  const blocked = resolveLinkPreviewImageProxy('https://opengraph.githubassets.com/hash/repo')

  assert.ok(allowed)
  assert.equal(allowed?.rule.id, 'douban')
  assert.equal(blocked, null)
})

test('isLinkPreviewImageWhitelisted checks source URLs directly', () => {
  assert.equal(
    isLinkPreviewImageWhitelisted('https://img1.doubanio.com/view/subject/l/public/s35172637.jpg'),
    true
  )
  assert.equal(
    isLinkPreviewImageWhitelisted('https://opengraph.githubassets.com/hash/repo'),
    false
  )
})
