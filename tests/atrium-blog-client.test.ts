import assert from 'node:assert/strict'
import test from 'node:test'
import {
  AtriumBlogApiError,
  AtriumBlogResponseError,
  createAtriumBlogClient,
  getAtriumBlogApiUrl
} from '../lib/server/atriumBlog'

function post(id: string, slug: string) {
  return {
    id,
    title: 'Post ' + id,
    slug,
    summary: 'Summary ' + id,
    tags: ['技术'],
    type: ['Post'],
    status: ['Published'],
    formats: [],
    fullWidth: false,
    date: 1770000000000
  }
}

function response(data: unknown, nextCursor: string | null = null): Response {
  return Response.json({
    data,
    meta: {
      schemaVersion: 1,
      revision: 'revision-1',
      syncedAt: '2026-09-19T00:00:00.000Z',
      nextCursor
    }
  })
}

test('Atrium client traverses all post pages using the frozen cursor contract', async () => {
  const calls: URL[] = []
  const fetchImplementation: typeof fetch = async (input) => {
    const url = new URL(String(input))
    calls.push(url)
    if (url.searchParams.get('cursor') === 'cursor-2') {
      return response([post('post-2', 'second')])
    }
    return response([post('post-1', 'first')], 'cursor-2')
  }
  const client = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    fetchImplementation
  })

  const posts = await client.listAllPosts({ kind: 'all' })

  assert.deepEqual(posts.map(item => item.id), ['post-1', 'post-2'])
  assert.equal(calls.length, 2)
  assert.equal(calls[0].pathname, '/api/v1/blog/posts')
  assert.equal(calls[0].searchParams.get('kind'), 'all')
  assert.equal(calls[0].searchParams.get('limit'), '100')
  assert.equal(calls[1].searchParams.get('cursor'), 'cursor-2')
})

test('Atrium client restarts a traversal when a cursor snapshot expires', async () => {
  const calls: URL[] = []
  const fetchImplementation: typeof fetch = async (input) => {
    const url = new URL(String(input))
    calls.push(url)
    if (calls.length === 2) {
      return Response.json({
        error: {
          code: 'cursor_expired',
          message: 'Snapshot expired'
        }
      }, { status: 409 })
    }
    if (url.searchParams.get('cursor') === 'retry-cursor') {
      return response([post('post-3', 'third')])
    }
    return response([post(calls.length === 1 ? 'post-1' : 'post-2', calls.length === 1 ? 'first' : 'second')], calls.length === 1 ? 'first-cursor' : 'retry-cursor')
  }
  const client = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    fetchImplementation
  })

  const posts = await client.listAllPosts()

  assert.deepEqual(posts.map(item => item.id), ['post-2', 'post-3'])
  assert.equal(calls.length, 4)
  assert.equal(calls[0].searchParams.get('cursor'), null)
  assert.equal(calls[1].searchParams.get('cursor'), 'first-cursor')
  assert.equal(calls[2].searchParams.get('cursor'), null)
  assert.equal(calls[3].searchParams.get('cursor'), 'retry-cursor')
})

test('Atrium client bounds traversal pages instead of following an unbounded cursor chain', async () => {
  let calls = 0
  const client = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    maxPagesPerTraversal: 1,
    fetchImplementation: async () => {
      calls += 1
      return response([post('post-' + calls, 'post-' + calls)], 'next-' + calls)
    }
  })

  await assert.rejects(
    () => client.listAllPosts(),
    /pagination exceeded the page limit/
  )
  assert.equal(calls, 1)
})

test('Atrium client sends search filters upstream and bounds the requested limit', async () => {
  let requestUrl: URL | null = null
  const client = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    fetchImplementation: async (input) => {
      requestUrl = new URL(String(input))
      return response([post('post-1', 'first')])
    }
  })

  const posts = await client.searchPosts({
    query: 'Agent systems',
    tag: '技术',
    kind: 'all',
    limit: 999
  })

  assert.equal(posts.length, 1)
  assert.ok(requestUrl)
  assert.equal(requestUrl.pathname, '/api/v1/blog/search')
  assert.equal(requestUrl.searchParams.get('q'), 'Agent systems')
  assert.equal(requestUrl.searchParams.get('tag'), '技术')
  assert.equal(requestUrl.searchParams.get('kind'), 'all')
  assert.equal(requestUrl.searchParams.get('limit'), '50')
})

test('Atrium client surfaces structured API errors and rejects malformed payloads', async () => {
  const unavailableClient = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    fetchImplementation: async () => Response.json({
      error: {
        code: 'not_ready',
        message: 'No published snapshot'
      }
    }, { status: 503 })
  })

  await assert.rejects(
    () => unavailableClient.getTags(),
    (error: unknown) => {
      assert.ok(error instanceof AtriumBlogApiError)
      assert.equal(error.status, 503)
      assert.equal(error.code, 'not_ready')
      assert.match(error.message, /No published snapshot/)
      return true
    }
  )

  const malformedClient = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    fetchImplementation: async () => response([{ id: 'broken' }])
  })

  await assert.rejects(
    () => malformedClient.listPosts(),
    (error: unknown) => {
      assert.ok(error instanceof AtriumBlogResponseError)
      assert.match(error.message, /missing title/)
      return true
    }
  )
})

test('Atrium API URL is required and must be a plain HTTP(S) origin', () => {
  assert.throws(
    () => getAtriumBlogApiUrl({}),
    /Missing required environment variable: ATRIUM_BLOG_API_URL/
  )
  assert.throws(
    () => getAtriumBlogApiUrl({ ATRIUM_BLOG_API_URL: 'file:///tmp/blog' }),
    /Invalid ATRIUM_BLOG_API_URL/
  )
  assert.equal(
    getAtriumBlogApiUrl({ ATRIUM_BLOG_API_URL: 'https://atrium.test/api/v1/blog/' }),
    'https://atrium.test/api/v1/blog'
  )
})

test('Atrium client forwards caller cancellation and enforces its request timeout', async () => {
  const callerAbort = new AbortController()
  let receivedSignal: AbortSignal | null = null
  const abortableClient = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    fetchImplementation: async (_input, init) => {
      receivedSignal = init?.signal as AbortSignal
      return new Promise<Response>((_resolve, reject) => {
        receivedSignal?.addEventListener('abort', () => reject(receivedSignal?.reason), { once: true })
      })
    }
  })
  const pending = abortableClient.getTags({ signal: callerAbort.signal })
  callerAbort.abort(new Error('caller cancelled'))

  await assert.rejects(pending, /caller cancelled/)
  assert.ok(receivedSignal?.aborted)

  const timeoutClient = createAtriumBlogClient({
    baseUrl: 'https://atrium.test/api/v1/blog',
    requestTimeoutMs: 1,
    fetchImplementation: async (_input, init) => new Promise<Response>((_resolve, reject) => {
      const requestSignal = init?.signal as AbortSignal
      requestSignal.addEventListener('abort', () => reject(requestSignal.reason), { once: true })
    })
  })

  await assert.rejects(
    () => timeoutClient.getTags(),
    (error: unknown) => {
      assert.ok(error instanceof Error)
      assert.equal(error.name, 'TimeoutError')
      return true
    }
  )
})
