import { createHmac, timingSafeEqual } from 'node:crypto'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'
import { mapPageToPost, normalizeNotionUuid, type NotionProperties } from '@/lib/notion/postMapper'
import {
  NOTION_WEBHOOK_REVALIDATE_PATHS,
  NOTION_WEBHOOK_REVALIDATE_TAGS
} from '@/lib/server/cache'

type NotionParentRef = {
  id?: string
  type?: string
}

export interface NotionWebhookPayload {
  verification_token?: string
  type?: string
  entity?: {
    id?: string
    type?: string
  }
  data?: {
    parent?: NotionParentRef
    [key: string]: unknown
  }
  [key: string]: unknown
}

interface ResolveOptions {
  configuredDataSourceId?: string
  basePath?: string
  resolvePageParentDataSourceId?: (pageId: string) => Promise<string>
  resolvePagePath?: (pageId: string) => Promise<string>
}

export interface NotionWebhookResolution {
  accepted: boolean
  shouldRevalidate: boolean
  isVerificationRequest: boolean
  reason: string
  tags: string[]
  paths: string[]
  eventType: string
  entityId: string
}

const PAGE_EVENT_PREFIX = 'page.'
const DATA_SOURCE_EVENT_PREFIX = 'data_source.'
const DATABASE_EVENT_PREFIX = 'database.'
const HOME_ONLY_PAGE_EVENT_TYPES = new Set([
  'page.created',
  'page.undeleted'
])
const SINGLE_PAGE_EVENT_TYPES = new Set([
  'page.content_updated',
  'page.properties_updated'
])
const HOME_AND_PAGE_EVENT_TYPES = new Set([
  'page.deleted',
  'page.moved'
])
const IGNORED_CONTAINER_CONTENT_EVENT_TYPES = new Set([
  'data_source.content_updated',
  'database.content_updated'
])
const BROAD_CONTAINER_SCHEMA_EVENT_TYPES = new Set([
  'data_source.schema_updated',
  'database.schema_updated'
])

const RELEVANT_PAGE_EVENT_TYPES = new Set([
  'page.created',
  'page.deleted',
  'page.moved',
  'page.properties_updated',
  'page.content_updated',
  'page.undeleted'
])

const RELEVANT_CONTAINER_EVENT_TYPES = new Set([
  'data_source.created',
  'data_source.deleted',
  'data_source.moved',
  'data_source.schema_updated',
  'data_source.content_updated',
  'data_source.undeleted',
  'database.created',
  'database.deleted',
  'database.moved',
  'database.schema_updated',
  'database.content_updated',
  'database.undeleted'
])

function normalizeVerificationToken(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export function parseNotionWebhookPayload(rawBody: string): NotionWebhookPayload {
  const trimmed = `${rawBody || ''}`.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  if (!parsed || typeof parsed !== 'object') return {}
  return parsed as NotionWebhookPayload
}

export function isNotionVerificationRequest(payload: NotionWebhookPayload): boolean {
  return !!normalizeVerificationToken(payload.verification_token) && !`${payload.type || ''}`.trim()
}

export function computeNotionWebhookSignature(rawBody: string, verificationToken: string): string {
  return `sha256=${createHmac('sha256', verificationToken).update(rawBody).digest('hex')}`
}

export function isValidNotionWebhookSignature(
  rawBody: string,
  secret: string,
  signatureHeader: string | null
): boolean {
  const expectedToken = secret.trim()
  const actualSignature = `${signatureHeader || ''}`.trim()

  if (!expectedToken || !actualSignature) return false

  const computedSignature = computeNotionWebhookSignature(rawBody, expectedToken)
  const left = Buffer.from(computedSignature)
  const right = Buffer.from(actualSignature)

  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function getEventType(payload: NotionWebhookPayload): string {
  return `${payload.type || ''}`.trim()
}

function getEntityId(payload: NotionWebhookPayload): string {
  return normalizeNotionUuid(payload.entity?.id)
}

function getParentRef(payload: NotionWebhookPayload): NotionParentRef {
  const parent = payload.data?.parent
  if (!parent || typeof parent !== 'object') return {}
  return parent as NotionParentRef
}

function isRelevantPageEvent(eventType: string): boolean {
  return RELEVANT_PAGE_EVENT_TYPES.has(eventType)
}

function isRelevantContainerEvent(eventType: string): boolean {
  return RELEVANT_CONTAINER_EVENT_TYPES.has(eventType)
}

function getHomePath(basePath = ''): string {
  return buildInternalSlugHref(basePath, '')
}

function getPagePathFromPayload(payload: NotionWebhookPayload, basePath = ''): string {
  const data = payload.data
  if (!data || typeof data !== 'object') return ''
  const properties = (data as { properties?: NotionProperties }).properties || {}

  const post = mapPageToPost({
    id: getEntityId(payload),
    properties
  })
  const slug = `${post?.slug || ''}`.trim()
  return slug ? buildInternalSlugHref(basePath, slug) : ''
}

async function resolvePagePath(
  payload: NotionWebhookPayload,
  { basePath, resolvePagePath: resolvePagePathById }: ResolveOptions
): Promise<string> {
  const payloadPath = getPagePathFromPayload(payload, basePath)
  if (payloadPath) return payloadPath

  const entityId = getEntityId(payload)
  if (!entityId || !resolvePagePathById) return ''
  return resolvePagePathById(entityId)
}

async function resolveTargetsForEvent(
  payload: NotionWebhookPayload,
  options: ResolveOptions
): Promise<{ tags: string[], paths: string[], reason: string, shouldRevalidate: boolean }> {
  const eventType = getEventType(payload)
  const homePath = getHomePath(options.basePath)

  if (HOME_ONLY_PAGE_EVENT_TYPES.has(eventType)) {
    return {
      tags: [],
      paths: [homePath],
      reason: 'revalidate-home',
      shouldRevalidate: true
    }
  }

  if (SINGLE_PAGE_EVENT_TYPES.has(eventType)) {
    const pagePath = await resolvePagePath(payload, options)
    return pagePath
      ? {
          tags: [],
          paths: [pagePath],
          reason: 'revalidate-page',
          shouldRevalidate: true
        }
      : {
          tags: [],
          paths: [],
          reason: 'missing-page-path',
          shouldRevalidate: false
        }
  }

  if (HOME_AND_PAGE_EVENT_TYPES.has(eventType)) {
    const pagePath = await resolvePagePath(payload, options)
    return {
      tags: [],
      paths: unique([homePath, pagePath]),
      reason: 'revalidate-home-and-page',
      shouldRevalidate: true
    }
  }

  if (IGNORED_CONTAINER_CONTENT_EVENT_TYPES.has(eventType)) {
    return {
      tags: [],
      paths: [],
      reason: 'ignored-container-content-event',
      shouldRevalidate: false
    }
  }

  if (BROAD_CONTAINER_SCHEMA_EVENT_TYPES.has(eventType)) {
    return {
      tags: unique(NOTION_WEBHOOK_REVALIDATE_TAGS),
      paths: unique(NOTION_WEBHOOK_REVALIDATE_PATHS),
      reason: 'revalidate-schema',
      shouldRevalidate: true
    }
  }

  return {
    tags: [],
    paths: [homePath],
    reason: 'revalidate-home',
    shouldRevalidate: true
  }
}

async function matchesConfiguredDataSource(
  payload: NotionWebhookPayload,
  { configuredDataSourceId, resolvePageParentDataSourceId }: ResolveOptions
): Promise<boolean> {
  const configuredId = normalizeNotionUuid(configuredDataSourceId)
  if (!configuredId) return true

  const eventType = getEventType(payload)
  const entityId = getEntityId(payload)
  const parent = getParentRef(payload)
  const parentId = normalizeNotionUuid(parent.id)

  if (eventType.startsWith(DATA_SOURCE_EVENT_PREFIX) && entityId) {
    return entityId === configuredId
  }

  if (eventType.startsWith(DATABASE_EVENT_PREFIX)) {
    // Legacy database events don't always map cleanly to a data_source_id after 2025-09-03.
    // Prefer over-invalidating to missing a content refresh.
    return true
  }

  if (!eventType.startsWith(PAGE_EVENT_PREFIX)) {
    return false
  }

  if (parentId && (parent.type === 'data_source' || parent.type === 'data_source_id' || parent.type === 'database' || parent.type === 'database_id')) {
    return parentId === configuredId
  }

  if (!entityId || !resolvePageParentDataSourceId) {
    return false
  }

  const resolvedParentId = normalizeNotionUuid(await resolvePageParentDataSourceId(entityId))
  return resolvedParentId === configuredId
}

export async function resolveNotionWebhookRevalidation(
  payload: NotionWebhookPayload,
  options: ResolveOptions = {}
): Promise<NotionWebhookResolution> {
  const eventType = getEventType(payload)
  const entityId = getEntityId(payload)

  if (isNotionVerificationRequest(payload)) {
    return {
      accepted: true,
      shouldRevalidate: false,
      isVerificationRequest: true,
      reason: 'verification',
      tags: [],
      paths: [],
      eventType: '',
      entityId: ''
    }
  }

  if (!eventType) {
    return {
      accepted: false,
      shouldRevalidate: false,
      isVerificationRequest: false,
      reason: 'missing-event-type',
      tags: [],
      paths: [],
      eventType: '',
      entityId
    }
  }

  const isRelevantEvent = isRelevantPageEvent(eventType) || isRelevantContainerEvent(eventType)
  if (!isRelevantEvent) {
    return {
      accepted: true,
      shouldRevalidate: false,
      isVerificationRequest: false,
      reason: 'ignored-event-type',
      tags: [],
      paths: [],
      eventType,
      entityId
    }
  }

  const matches = await matchesConfiguredDataSource(payload, options)
  if (!matches) {
    return {
      accepted: true,
      shouldRevalidate: false,
      isVerificationRequest: false,
      reason: 'ignored-unrelated-entity',
      tags: [],
      paths: [],
      eventType,
      entityId
    }
  }

  const targets = await resolveTargetsForEvent(payload, options)
  if (!targets.shouldRevalidate) {
    return {
      accepted: true,
      shouldRevalidate: false,
      isVerificationRequest: false,
      reason: targets.reason,
      tags: [],
      paths: [],
      eventType,
      entityId
    }
  }

  return {
    accepted: true,
    shouldRevalidate: true,
    isVerificationRequest: false,
    reason: targets.reason,
    tags: targets.tags,
    paths: targets.paths,
    eventType,
    entityId
  }
}
