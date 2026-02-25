const API_BASE_URL = 'https://api.notion.com/v1'
const DEFAULT_API_VERSION = '2025-09-03'
const MAX_RETRIES = 3

function getRequiredEnv(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeErrorMessage(payload, status) {
  if (!payload) return `Notion request failed with status ${status}`
  if (typeof payload.message === 'string' && payload.message.length) {
    return payload.message
  }
  return `Notion request failed with status ${status}`
}

async function notionRequest(path, { method = 'GET', body, signal } = {}) {
  const token = getRequiredEnv('NOTION_INTEGRATION_TOKEN')
  const notionVersion = process.env.NOTION_API_VERSION || DEFAULT_API_VERSION
  const url = `${API_BASE_URL}${path}`

  let attempt = 0
  while (true) {
    const response = await fetch(url, {
      method,
      signal,
      headers: {
        Authorization: `Bearer ${token}`,
        'Notion-Version': notionVersion,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    const shouldRetry =
      response.status === 429 ||
      (response.status >= 500 && response.status <= 599)

    if (response.ok) {
      return payload
    }

    if (shouldRetry && attempt < MAX_RETRIES) {
      const retryAfter = Number(response.headers.get('retry-after') || 0)
      const backoffMs =
        retryAfter > 0 ? retryAfter * 1000 : Math.min(500 * (2 ** attempt), 8000)
      await sleep(backoffMs)
      attempt += 1
      continue
    }

    const error = new Error(normalizeErrorMessage(payload, response.status))
    error.status = response.status
    error.payload = payload
    throw error
  }
}

async function retrieveDataSource(dataSourceId) {
  return notionRequest(`/data_sources/${dataSourceId}`)
}

async function queryDataSource(dataSourceId, body = {}) {
  return notionRequest(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body
  })
}

async function queryAllDataSourcePages(dataSourceId, body = {}) {
  const results = []
  let nextCursor = null

  do {
    const response = await queryDataSource(dataSourceId, {
      page_size: 100,
      ...body,
      ...(nextCursor ? { start_cursor: nextCursor } : {})
    })

    results.push(...(response?.results || []))
    nextCursor = response?.has_more ? response?.next_cursor : null
  } while (nextCursor)

  return results
}

async function listBlockChildren(blockId, startCursor = null) {
  const searchParams = new URLSearchParams({
    page_size: '100'
  })
  if (startCursor) {
    searchParams.set('start_cursor', startCursor)
  }
  return notionRequest(`/blocks/${blockId}/children?${searchParams.toString()}`)
}

async function listAllBlockChildren(blockId) {
  const results = []
  let nextCursor = null

  do {
    const response = await listBlockChildren(blockId, nextCursor)
    results.push(...(response?.results || []))
    nextCursor = response?.has_more ? response?.next_cursor : null
  } while (nextCursor)

  return results
}

const notionApi = {
  retrieveDataSource,
  queryDataSource,
  queryAllDataSourcePages,
  listBlockChildren,
  listAllBlockChildren
}

export { notionRequest }
export default notionApi
