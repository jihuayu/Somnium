import type { APIRoute } from 'astro'
import {
  DEFAULT_CACHE_REVALIDATE_PATHS,
  DEFAULT_CACHE_REVALIDATE_TAGS
} from '@/lib/server/cache'
import { revalidatePath, revalidateTag } from '@/lib/server/runtimeCache'

interface RevalidateBody {
  token?: unknown
  tags?: unknown
  paths?: unknown
}

function normalizeToken(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function parseAuthorizationToken(value: string | null): string {
  if (!value) return ''
  const trimmed = value.trim()
  const bearerPrefix = /^bearer\s+/i
  if (!bearerPrefix.test(trimmed)) return trimmed
  return trimmed.replace(bearerPrefix, '').trim()
}

function parseListValue(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map(item => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }

  return []
}

function parseQueryList(searchParams: URLSearchParams, key: 'tag' | 'tags' | 'path' | 'paths'): string[] {
  const values = searchParams.getAll(key)
  if (!values.length) return []
  const output: string[] = []
  for (const value of values) {
    const segments = value.split(',')
    for (const segment of segments) {
      const trimmed = segment.trim()
      if (trimmed) output.push(trimmed)
    }
  }
  return output
}

function unique(values: string[]): string[] {
  const set = new Set<string>()
  for (const value of values) {
    if (!set.has(value)) set.add(value)
  }
  return Array.from(set)
}

function normalizePath(pathValue: string): string {
  const trimmed = pathValue.trim()
  if (!trimmed) return ''
  if (trimmed.startsWith('/')) return trimmed
  return `/${trimmed}`
}

function getServerToken(): string {
  return (
    process.env.CACHE_REVALIDATE_TOKEN?.trim() ||
    process.env.REVALIDATE_TOKEN?.trim() ||
    ''
  )
}

function resolveRequestToken(request: Request, body: RevalidateBody): string {
  const url = new URL(request.url)
  const headerToken = normalizeToken(request.headers.get('x-cache-revalidate-token'))
    || normalizeToken(request.headers.get('x-revalidate-token'))
    || parseAuthorizationToken(request.headers.get('authorization'))
  if (headerToken) return headerToken

  const queryToken = normalizeToken(url.searchParams.get('token'))
  if (queryToken) return queryToken

  return normalizeToken(body.token)
}

function resolveTargets(request: Request, body: RevalidateBody): {
  tags: string[]
  paths: string[]
} {
  const url = new URL(request.url)
  const bodyTags = parseListValue(body.tags)
  const bodyPaths = parseListValue(body.paths).map(normalizePath).filter(Boolean)

  const queryTags = [
    ...parseQueryList(url.searchParams, 'tag'),
    ...parseQueryList(url.searchParams, 'tags')
  ]
  const queryPaths = [
    ...parseQueryList(url.searchParams, 'path'),
    ...parseQueryList(url.searchParams, 'paths')
  ].map(normalizePath).filter(Boolean)

  const requestedTags = unique([...queryTags, ...bodyTags])
  const requestedPaths = unique([...queryPaths, ...bodyPaths])

  const hasRequestedTags = requestedTags.length > 0
  const hasRequestedPaths = requestedPaths.length > 0

  const tags = hasRequestedTags
    ? requestedTags
    : hasRequestedPaths
      ? []
      : [...DEFAULT_CACHE_REVALIDATE_TAGS]

  const paths = hasRequestedPaths
    ? requestedPaths
    : hasRequestedTags
      ? []
      : [...DEFAULT_CACHE_REVALIDATE_PATHS]

  return { tags, paths }
}

async function parseBody(request: Request): Promise<RevalidateBody> {
  if (request.method !== 'POST') return {}
  const text = await request.text()
  if (!text.trim()) return {}

  try {
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as RevalidateBody
  } catch {
    throw new Error('Invalid JSON body')
  }
}

function applyRevalidation(tags: string[], paths: string[]) {
  for (const tag of tags) {
    revalidateTag(tag)
  }

  for (const path of paths) {
    revalidatePath(path)
  }
}

async function handle(request: Request) {
  const serverToken = getServerToken()
  if (!serverToken) {
    return Response.json(
      { error: 'Server is missing CACHE_REVALIDATE_TOKEN' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  let body: RevalidateBody = {}
  try {
    body = await parseBody(request)
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const token = resolveRequestToken(request, body)
  if (!token || token !== serverToken) {
    return Response.json(
      { error: 'Unauthorized' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { tags, paths } = resolveTargets(request, body)
  applyRevalidation(tags, paths)

  return Response.json(
    {
      ok: true,
      tags,
      paths,
      timestamp: new Date().toISOString()
    },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export const GET: APIRoute = async ({ request }) => handle(request)
export const POST: APIRoute = async ({ request }) => handle(request)