import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { GET as getSearch } from '../app/api/search/route'
import { GET as getTags } from '../app/api/tags/route'

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

test('Atrium search and tags keep an upstream unavailable response as 503 without empty success data', async () => {
  const previousApiUrl = process.env.ATRIUM_BLOG_API_URL
  const previousFetch = globalThis.fetch
  process.env.ATRIUM_BLOG_API_URL = 'https://atrium.test/api/v1/blog'
  globalThis.fetch = async () => Response.json({
    error: {
      code: 'not_ready',
      message: 'No published snapshot'
    }
  }, { status: 503 })

  try {
    const [search, tags] = await Promise.all([
      getSearch(new NextRequest('http://localhost/api/search?q=fixture')),
      getTags()
    ])

    assert.equal(search.status, 503)
    assert.equal(search.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await search.json(), { error: 'Blog search unavailable' })

    assert.equal(tags.status, 503)
    assert.equal(tags.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await tags.json(), { error: 'Blog tags unavailable' })
  } finally {
    globalThis.fetch = previousFetch
    restoreEnvironment('ATRIUM_BLOG_API_URL', previousApiUrl)
  }
})
