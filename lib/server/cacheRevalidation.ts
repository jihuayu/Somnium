import 'server-only'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'
import {
  ATRIUM_BLOG_ALL_CACHE_TAGS,
  ATRIUM_BLOG_COLLECTION_CACHE_TAGS,
  ATRIUM_BLOG_PAGE_CONTENT_CACHE_TAGS
} from '@/lib/server/cache'
import { config } from '@/lib/server/config'

type CacheChangeKind = 'content' | 'properties' | 'visibility'
type CacheScope = 'pages' | 'site'

export interface AtriumCacheChange {
  pageId: string
  oldSlug: string | null
  newSlug: string | null
  kind: CacheChangeKind
}

export interface AtriumCacheRevalidateNotification {
  notificationId: string
  revision: string
  scope: CacheScope
  changes: AtriumCacheChange[]
}

export interface AtriumCacheRevalidationTargets {
  tags: string[]
  paths: string[]
}

export interface CacheRevalidationFunctions {
  revalidateTag(tag: string, profile: { expire: number }): unknown
  revalidatePath(path: string, type?: 'page' | 'layout'): unknown
}

class CacheRevalidateValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CacheRevalidateValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function assertAllowedKeys(value: Record<string, unknown>, allowedKeys: string[], label: string): void {
  const allowed = new Set(allowedKeys)
  const unexpected = Object.keys(value).find(key => !allowed.has(key))
  if (unexpected) {
    throw new CacheRevalidateValidationError('Invalid ' + label + ': unexpected field ' + unexpected)
  }
}

function parseRequiredString(value: unknown, label: string, maxLength = 256): string {
  if (typeof value !== 'string') {
    throw new CacheRevalidateValidationError('Invalid ' + label)
  }

  const normalized = value.trim()
  if (
    !normalized ||
    normalized.length > maxLength ||
    normalized !== value ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) {
    throw new CacheRevalidateValidationError('Invalid ' + label)
  }
  return normalized
}

function parseSlug(value: unknown, label: string): string | null {
  if (value === null) return null
  const slug = parseRequiredString(value, label)
  if (
    slug === '.' ||
    slug === '..' ||
    slug.startsWith('/') ||
    /[\\/#?]/.test(slug)
  ) {
    throw new CacheRevalidateValidationError('Invalid ' + label)
  }
  return slug
}

function parseChange(value: unknown, index: number): AtriumCacheChange {
  if (!isRecord(value)) {
    throw new CacheRevalidateValidationError('Invalid changes[' + index + ']')
  }
  assertAllowedKeys(value, ['pageId', 'oldSlug', 'newSlug', 'kind'], 'changes[' + index + ']')

  const kind = value.kind
  if (kind !== 'content' && kind !== 'properties' && kind !== 'visibility') {
    throw new CacheRevalidateValidationError('Invalid changes[' + index + '].kind')
  }

  return {
    pageId: parseRequiredString(value.pageId, 'changes[' + index + '].pageId', 512),
    oldSlug: parseSlug(value.oldSlug, 'changes[' + index + '].oldSlug'),
    newSlug: parseSlug(value.newSlug, 'changes[' + index + '].newSlug'),
    kind
  }
}

export function parseAtriumCacheRevalidateNotification(value: unknown): AtriumCacheRevalidateNotification {
  if (!isRecord(value)) {
    throw new CacheRevalidateValidationError('Invalid callback body')
  }
  assertAllowedKeys(value, ['notificationId', 'revision', 'scope', 'changes'], 'callback body')

  if (value.scope !== 'pages' && value.scope !== 'site') {
    throw new CacheRevalidateValidationError('Invalid scope')
  }
  if (!Array.isArray(value.changes) || value.changes.length > 200) {
    throw new CacheRevalidateValidationError('Invalid changes')
  }
  if (value.scope === 'pages' && value.changes.length === 0) {
    throw new CacheRevalidateValidationError('Pages callbacks require at least one change')
  }

  return {
    notificationId: parseRequiredString(value.notificationId, 'notificationId'),
    revision: parseRequiredString(value.revision, 'revision'),
    scope: value.scope,
    changes: value.changes.map(parseChange)
  }
}

function unique(values: Iterable<string>): string[] {
  return Array.from(new Set(values))
}

function sitePath(path: string): string {
  return buildInternalSlugHref(config.path || '', path)
}

function buildSiteRevalidationPaths(): string[] {
  return [
    sitePath(''),
    sitePath('search'),
    sitePath('feed'),
    sitePath('sitemap.xml'),
    sitePath('api/tags'),
    sitePath('api/og/notion'),
    sitePath('[slug]'),
    sitePath('page/[page]'),
    sitePath('tag/[tag]')
  ]
}

function buildSlugPath(slug: string): string {
  return sitePath(encodeURIComponent(slug))
}

/**
 * Maps Atrium semantic changes to Somnium-owned cache tags and routes.
 * The request can never select cache tags or arbitrary Next.js paths.
 */
export function buildAtriumCacheRevalidationTargets(notification: AtriumCacheRevalidateNotification): AtriumCacheRevalidationTargets {
  if (notification.scope === 'site') {
    return {
      tags: [...ATRIUM_BLOG_ALL_CACHE_TAGS],
      paths: buildSiteRevalidationPaths()
    }
  }

  const tags = new Set<string>()
  const paths = new Set<string>()
  let needsCollectionRefresh = false

  for (const change of notification.changes) {
    for (const tag of ATRIUM_BLOG_PAGE_CONTENT_CACHE_TAGS) tags.add(tag)

    if (change.oldSlug) paths.add(buildSlugPath(change.oldSlug))
    if (change.newSlug) paths.add(buildSlugPath(change.newSlug))

    if (change.kind === 'content') {
      paths.add(sitePath('feed'))
    } else {
      needsCollectionRefresh = true
      for (const tag of ATRIUM_BLOG_COLLECTION_CACHE_TAGS) tags.add(tag)
    }
  }

  if (needsCollectionRefresh) {
    for (const path of buildSiteRevalidationPaths()) paths.add(path)
  }

  return {
    tags: unique(tags),
    paths: unique(paths)
  }
}

/**
 * Applies targets supplied by the semantic mapper. Errors intentionally
 * propagate so Atrium retains the outbox item and retries delivery.
 */
export function applyAtriumCacheRevalidation(
  { tags, paths }: AtriumCacheRevalidationTargets,
  { revalidateTag, revalidatePath }: CacheRevalidationFunctions
): void {
  for (const tag of tags) {
    revalidateTag(tag, { expire: 0 })
  }

  for (const path of paths) {
    if (path.includes('[') || path.includes(']')) {
      revalidatePath(path, 'page')
    } else {
      revalidatePath(path)
    }
  }
}
