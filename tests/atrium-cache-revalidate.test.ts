import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { GET, POST } from '../app/api/cache/revalidate/route'
import {
  applyAtriumCacheRevalidation,
  buildAtriumCacheRevalidationTargets,
  parseAtriumCacheRevalidateNotification
} from '../lib/server/cacheRevalidation'

const validNotification = {
  notificationId: 'outbox-1',
  revision: '184',
  scope: 'pages',
  changes: [
    {
      pageId: 'page-1',
      oldSlug: 'old-title',
      newSlug: 'new-title',
      kind: 'properties'
    }
  ]
} as const

function request(body: unknown, authorization = ''): NextRequest {
  return new NextRequest('http://localhost/api/cache/revalidate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(authorization ? { authorization } : {})
    },
    body: JSON.stringify(body)
  })
}

function restoreCacheToken(previousValue: string | undefined): void {
  if (previousValue === undefined) {
    delete process.env.CACHE_REVALIDATE_TOKEN
  } else {
    process.env.CACHE_REVALIDATE_TOKEN = previousValue
  }
}

test('cache callback rejects GET and unauthenticated calls', async () => {
  const getResponse = await GET()
  assert.equal(getResponse.status, 405)

  const previousToken = process.env.CACHE_REVALIDATE_TOKEN
  process.env.CACHE_REVALIDATE_TOKEN = 'callback-secret'
  try {
    const missingBearer = await POST(request(validNotification))
    assert.equal(missingBearer.status, 401)

    const nonBearer = await POST(request(validNotification, 'callback-secret'))
    assert.equal(nonBearer.status, 401)

    const wrongBearer = await POST(request(validNotification, 'Bearer wrong-secret'))
    assert.equal(wrongBearer.status, 401)
  } finally {
    restoreCacheToken(previousToken)
  }
})

test('cache callback reports missing server configuration and rejects an invalid schema', async () => {
  const previousToken = process.env.CACHE_REVALIDATE_TOKEN
  delete process.env.CACHE_REVALIDATE_TOKEN
  try {
    const missingConfig = await POST(request(validNotification, 'Bearer callback-secret'))
    assert.equal(missingConfig.status, 500)
  } finally {
    restoreCacheToken(previousToken)
  }

  process.env.CACHE_REVALIDATE_TOKEN = 'callback-secret'
  try {
    const injectedTarget = await POST(request({
      ...validNotification,
      tags: ['arbitrary-cache-tag']
    }, 'Bearer callback-secret'))
    assert.equal(injectedTarget.status, 400)
    assert.match((await injectedTarget.json()).error, /unexpected field tags/)

    const unsafeSlug = await POST(request({
      ...validNotification,
      changes: [{
        ...validNotification.changes[0],
        newSlug: '/api/cache/revalidate'
      }]
    }, 'Bearer callback-secret'))
    assert.equal(unsafeSlug.status, 400)
  } finally {
    restoreCacheToken(previousToken)
  }
})

test('semantic callback mapping invalidates both historical and current slug paths', () => {
  const notification = parseAtriumCacheRevalidateNotification(validNotification)
  const targets = buildAtriumCacheRevalidationTargets(notification)

  assert.ok(targets.tags.includes('atrium-blog-documents'))
  assert.ok(targets.tags.includes('atrium-blog-posts'))
  assert.ok(targets.paths.includes('/old-title'))
  assert.ok(targets.paths.includes('/new-title'))
  assert.ok(targets.paths.includes('/page/[page]'))
  assert.ok(targets.paths.includes('/tag/[tag]'))

  const site = parseAtriumCacheRevalidateNotification({
    notificationId: 'outbox-site',
    revision: '185',
    scope: 'site',
    changes: []
  })
  assert.ok(buildAtriumCacheRevalidationTargets(site).paths.includes('/sitemap.xml'))
})

test('cache invalidation uses immediate tag expiry and propagates failures for Atrium retry', () => {
  const targets = buildAtriumCacheRevalidationTargets(
    parseAtriumCacheRevalidateNotification(validNotification)
  )
  const tags: Array<{ tag: string, profile: { expire: number } }> = []
  const paths: Array<{ path: string, type?: 'page' | 'layout' }> = []

  applyAtriumCacheRevalidation(targets, {
    revalidateTag(tag, profile) {
      tags.push({ tag, profile })
    },
    revalidatePath(path, type) {
      paths.push({ path, type })
    }
  })

  assert.ok(tags.every(item => item.profile.expire === 0))
  assert.deepEqual(
    paths.find(item => item.path === '/page/[page]'),
    { path: '/page/[page]', type: 'page' }
  )

  assert.throws(
    () => applyAtriumCacheRevalidation(targets, {
      revalidateTag() {
        throw new Error('cache backend unavailable')
      },
      revalidatePath() {}
    }),
    /cache backend unavailable/
  )
})
