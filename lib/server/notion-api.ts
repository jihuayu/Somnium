const API_BASE_URL = 'https://api.notion.com/v1'
const DEFAULT_API_VERSION = '2025-09-03'
const MAX_RETRIES = 3

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function normalizeErrorMessage(payload: any, status: number): string {
  if (!payload) return `Notion request failed with status ${status}`
  if (typeof payload.message === 'string' && payload.message.length) {
    return payload.message
  }
  return `Notion request failed with status ${status}`
}

interface RequestOptions {
  method?: string
  body?: Record<string, unknown>
  signal?: AbortSignal
}

async function notionRequest(path: string, { method = 'GET', body, signal }: RequestOptions = {}): Promise<any> {
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

    let payload: any = null
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

    const error: any = new Error(normalizeErrorMessage(payload, response.status))
    error.status = response.status
    error.payload = payload
    throw error
  }
}

async function retrieveDataSource(dataSourceId: string): Promise<any> {
  return notionRequest(`/data_sources/${dataSourceId}`)
}

async function queryDataSource(dataSourceId: string, body: Record<string, unknown> = {}): Promise<any> {
  return notionRequest(`/data_sources/${dataSourceId}/query`, {
    method: 'POST',
    body
  })
}

async function queryAllDataSourcePages(dataSourceId: string, body: Record<string, unknown> = {}): Promise<any[]> {
  const results: any[] = []
  let nextCursor: string | null = null

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

async function listBlockChildren(blockId: string, startCursor: string | null = null): Promise<any> {
  const searchParams = new URLSearchParams({
    page_size: '100'
  })
  if (startCursor) {
    searchParams.set('start_cursor', startCursor)
  }
  return notionRequest(`/blocks/${blockId}/children?${searchParams.toString()}`)
}

async function listAllBlockChildren(blockId: string): Promise<any[]> {
  const results: any[] = []
  let nextCursor: string | null = null

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
