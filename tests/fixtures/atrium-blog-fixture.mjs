import { createServer } from 'node:http'

const port = Number(process.env.ATRIUM_FIXTURE_PORT || 4010)
const basePath = '/api/v1/blog'

const post = {
  id: 'fixture-post-1',
  title: 'Atrium fixture post',
  slug: 'atrium-fixture-post',
  summary: 'A local fixture used to verify the Somnium production build.',
  tags: ['fixture'],
  type: ['Post'],
  status: ['Published'],
  formats: [],
  fullWidth: false,
  date: 1770000000000
}

const document = {
  pageId: post.id,
  rootIds: [],
  blocksById: {},
  childrenById: {},
  toc: []
}

function envelope(data, nextCursor = null) {
  return {
    data,
    meta: {
      schemaVersion: 1,
      revision: 'fixture-revision-1',
      syncedAt: '2026-09-19T00:00:00.000Z',
      nextCursor
    }
  }
}

function writeJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  if (req.method !== 'GET' || !url.pathname.startsWith(basePath)) {
    writeJson(res, 404, { error: { code: 'not_found', message: 'Not found' } })
    return
  }

  const path = url.pathname.slice(basePath.length)
  if (path === '/posts') {
    const kind = url.searchParams.get('kind') || 'post'
    writeJson(res, 200, envelope(kind === 'page' ? [] : [post]))
    return
  }
  if (path === '/posts/by-slug') {
    if (url.searchParams.get('slug') !== post.slug) {
      writeJson(res, 404, { error: { code: 'not_found', message: 'Not found' } })
      return
    }
    writeJson(res, 200, envelope(post))
    return
  }
  if (path === '/posts/' + post.id + '/document') {
    writeJson(res, 200, envelope(document))
    return
  }
  if (path === '/posts/' + post.id + '/og') {
    writeJson(res, 200, envelope({
      id: post.id,
      title: post.title,
      summary: post.summary,
      coverUrl: '',
      coverType: null
    }))
    return
  }
  if (path === '/tags') {
    writeJson(res, 200, envelope([{ name: 'fixture', count: 1 }]))
    return
  }
  if (path === '/search') {
    writeJson(res, 200, envelope([post]))
    return
  }

  writeJson(res, 404, { error: { code: 'not_found', message: 'Not found' } })
})

server.listen(port, '127.0.0.1', () => {
  console.log('ATRIUM_FIXTURE_URL=http://127.0.0.1:' + port + basePath)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
