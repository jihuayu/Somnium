import { buildPagePathFromPage, normalizeNotionUuid } from '../properties'
import { isRecord } from '../shared'
import type {
  NotionProperties,
  NotionWebhookPayload,
  NotionWebhookResolution,
  ResolveNotionWebhookOptions
} from '../types'
import { isNotionVerificationRequest } from './signature'

const PAGE_EVENT_PREFIX = 'page.'
const DATA_SOURCE_EVENT_PREFIX = 'data_source.'
const DATABASE_EVENT_PREFIX = 'database.'
type NotionWebhookEventAction = 'home' | 'page' | 'home-and-page' | 'ignore' | 'schema'

const EVENT_ACTIONS: Record<string, NotionWebhookEventAction> = {
  'page.created': 'home',
  'page.undeleted': 'home',
  'page.content_updated': 'page',
  'page.properties_updated': 'page',
  'page.deleted': 'home-and-page',
  'page.moved': 'home-and-page',
  'data_source.created': 'home',
  'data_source.deleted': 'home',
  'data_source.moved': 'home',
  'data_source.schema_updated': 'schema',
  'data_source.content_updated': 'ignore',
  'data_source.undeleted': 'home',
  'database.created': 'home',
  'database.deleted': 'home',
  'database.moved': 'home',
  'database.schema_updated': 'schema',
  'database.content_updated': 'ignore',
  'database.undeleted': 'home'
}

function getEventType(payload: NotionWebhookPayload): string {
  return `${payload.type || ''}`.trim()
}

function getEntityId(payload: NotionWebhookPayload): string {
  return normalizeNotionUuid(payload.entity?.id)
}

function getParentRef(payload: NotionWebhookPayload): { id?: string, type?: string } {
  const parent = payload.data?.parent
  return isRecord(parent) ? parent as { id?: string, type?: string } : {}
}

function isRelevantPageEvent(eventType: string): boolean {
  return eventType.startsWith(PAGE_EVENT_PREFIX) && eventType in EVENT_ACTIONS
}

function isRelevantContainerEvent(eventType: string): boolean {
  return (eventType.startsWith(DATA_SOURCE_EVENT_PREFIX) || eventType.startsWith(DATABASE_EVENT_PREFIX)) && eventType in EVENT_ACTIONS
}

function getPagePathFromPayload(payload: NotionWebhookPayload, basePath = ''): string {
  const properties = isRecord(payload.data?.properties) ? payload.data?.properties as NotionProperties : {}
  return buildPagePathFromPage({ properties }, basePath)
}

async function resolvePagePath(payload: NotionWebhookPayload, options: ResolveNotionWebhookOptions): Promise<string> {
  const payloadPath = getPagePathFromPayload(payload, options.basePath)
  if (payloadPath) return payloadPath

  const entityId = getEntityId(payload)
  if (!entityId || !options.resolvePagePath) return ''
  return options.resolvePagePath(entityId)
}

async function resolveTargetsForEvent(
  payload: NotionWebhookPayload,
  options: ResolveNotionWebhookOptions
): Promise<{ action: NotionWebhookResolution['action'], reason: string, shouldRefresh: boolean, resolvedPagePath: string }> {
  const eventType = getEventType(payload)
  const action = EVENT_ACTIONS[eventType]

  switch (action) {
    case 'home':
      return { action: 'home', reason: 'refresh-home', shouldRefresh: true, resolvedPagePath: '' }
    case 'page': {
      const pagePath = await resolvePagePath(payload, options)
      return pagePath
        ? { action: 'page', reason: 'refresh-page', shouldRefresh: true, resolvedPagePath: pagePath }
        : { action: 'page', reason: 'refresh-page-without-path', shouldRefresh: true, resolvedPagePath: '' }
    }
    case 'home-and-page': {
      const pagePath = await resolvePagePath(payload, options)
      return {
        action: 'home-and-page',
        reason: 'refresh-home-and-page',
        shouldRefresh: true,
        resolvedPagePath: pagePath
      }
    }
    case 'ignore':
      return { action: 'ignore', reason: 'ignored-container-content-event', shouldRefresh: false, resolvedPagePath: '' }
    case 'schema':
      return { action: 'schema', reason: 'refresh-schema', shouldRefresh: true, resolvedPagePath: '' }
    default:
      return { action: 'home', reason: 'refresh-home', shouldRefresh: true, resolvedPagePath: '' }
  }
}

async function matchesConfiguredDataSource(payload: NotionWebhookPayload, options: ResolveNotionWebhookOptions): Promise<boolean> {
  const configuredId = normalizeNotionUuid(options.configuredDataSourceId)
  if (!configuredId) return true

  const eventType = getEventType(payload)
  const entityId = getEntityId(payload)
  const parent = getParentRef(payload)
  const parentId = normalizeNotionUuid(parent.id)

  if (eventType.startsWith(DATA_SOURCE_EVENT_PREFIX) && entityId) {
    return entityId === configuredId
  }

  if (eventType.startsWith(DATABASE_EVENT_PREFIX)) {
    return true
  }

  if (!eventType.startsWith(PAGE_EVENT_PREFIX)) {
    return false
  }

  if (parentId && ['data_source', 'data_source_id', 'database', 'database_id'].includes(`${parent.type || ''}`)) {
    return parentId === configuredId
  }

  if (!entityId || !options.resolvePageParentDataSourceId) {
    return false
  }

  const resolvedParentId = normalizeNotionUuid(await options.resolvePageParentDataSourceId(entityId))
  return resolvedParentId === configuredId
}

/**
 * EN: Resolves webhook payload into generic refresh actions.
 * ZH: 将 webhook 事件解析为通用刷新动作。
 */
export async function resolveNotionWebhookEvent(
  payload: NotionWebhookPayload,
  options: ResolveNotionWebhookOptions = {}
): Promise<NotionWebhookResolution> {
  const eventType = getEventType(payload)
  const entityId = getEntityId(payload)

  if (isNotionVerificationRequest(payload)) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: true,
      reason: 'verification',
      eventType: '',
      entityId: '',
      action: 'verification',
      resolvedPagePath: ''
    }
  }

  if (!eventType) {
    return {
      accepted: false,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: 'missing-event-type',
      eventType: '',
      entityId,
      action: 'invalid',
      resolvedPagePath: ''
    }
  }

  const isRelevantEvent = isRelevantPageEvent(eventType) || isRelevantContainerEvent(eventType)
  if (!isRelevantEvent) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: 'ignored-event-type',
      eventType,
      entityId,
      action: 'ignore',
      resolvedPagePath: ''
    }
  }

  const matches = await matchesConfiguredDataSource(payload, options)
  if (!matches) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: 'ignored-unrelated-entity',
      eventType,
      entityId,
      action: 'ignore',
      resolvedPagePath: ''
    }
  }

  const targets = await resolveTargetsForEvent(payload, options)
  if (!targets.shouldRefresh) {
    return {
      accepted: true,
      shouldRefresh: false,
      isVerificationRequest: false,
      reason: targets.reason,
      eventType,
      entityId,
      action: targets.action,
      resolvedPagePath: ''
    }
  }

  return {
    accepted: true,
    shouldRefresh: true,
    isVerificationRequest: false,
    reason: targets.reason,
    eventType,
    entityId,
    action: targets.action,
    resolvedPagePath: targets.resolvedPagePath
  }
}
