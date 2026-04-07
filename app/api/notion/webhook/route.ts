import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  buildPagePathFromPage,
  getPageParentDataSourceId,
  isNotionVerificationRequest,
  isValidNotionWebhookSignature,
  normalizeNotionUuid,
  parseNotionWebhookPayload,
  resolveNotionWebhookEvent,
  type NotionWebhookResolution
} from '@jihuayu/notion-data'
import { config } from '@/lib/server/config'
import { infoServerEvent, warnServerError, warnServerEvent } from '@/lib/server/logging'
import { notionClient } from '@/lib/server/notionData'
import { NOTION_WEBHOOK_REVALIDATE_PATHS, NOTION_WEBHOOK_REVALIDATE_TAGS } from '@/lib/server/cache'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'

export const dynamic = 'force-dynamic'

const PAGE_CONTENT_REVALIDATE_TAGS = ['notion-post-blocks', 'feed-post-blocks'] as const
const PAGE_CONTENT_REVALIDATE_PATHS = ['/feed'] as const
const PAGE_PROPERTIES_REVALIDATE_TAGS = ['sitemap', 'notion-posts', 'notion-feed-posts', 'notion-og-page', 'page-link-map'] as const

function uniqueValues(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => !!value)))
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return `${error || 'Unknown error'}`
}

function isTruthyEnvValue(value?: string): boolean {
  const normalized = `${value || ''}`.trim().toLowerCase()
  return ['1', 'true', 'yes', 'on'].includes(normalized)
}

function shouldPrewarmWebhookPaths(): boolean {
  return isTruthyEnvValue(process.env.NOTION_WEBHOOK_PREWARM)
}

function summarizeWebhookPayload(payload: ReturnType<typeof parseNotionWebhookPayload>): Record<string, unknown> {
  const parent = payload.data?.parent && typeof payload.data.parent === 'object'
    ? payload.data.parent as { id?: string, type?: string }
    : {}
  const updatedProperties = Array.isArray(payload.data?.updated_properties)
    ? payload.data.updated_properties.map(item => `${item || ''}`.trim()).filter(Boolean)
    : []
  const updatedBlocks = Array.isArray(payload.data?.updated_blocks)
    ? payload.data.updated_blocks
      .map(item => {
        if (!item || typeof item !== 'object') return null
        const block = item as { id?: string, type?: string }
        return {
          id: normalizeNotionUuid(block.id),
          type: `${block.type || ''}`.trim()
        }
      })
      .filter((item): item is { id: string, type: string } => !!item)
    : []

  return {
    eventId: `${payload.id || ''}`.trim(),
    eventType: `${payload.type || ''}`.trim(),
    entityId: normalizeNotionUuid(payload.entity?.id),
    entityType: `${payload.entity?.type || ''}`.trim(),
    attemptNumber: typeof payload.attempt_number === 'number' ? payload.attempt_number : null,
    apiVersion: `${payload.api_version || ''}`.trim(),
    parentId: normalizeNotionUuid(parent.id),
    parentType: `${parent.type || ''}`.trim(),
    updatedProperties,
    updatedPropertyCount: updatedProperties.length,
    updatedBlocks,
    updatedBlockCount: updatedBlocks.length
  }
}

function getConfiguredVerificationToken(): string {
  return (
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
    process.env.NOTION_WEBHOOK_TOKEN?.trim() ||
    ''
  )
}

function getConfiguredSignatureSecret(configuredVerificationToken: string): string {
  return process.env.NOTION_WEBHOOK_SIGNATURE_SECRET?.trim() || configuredVerificationToken
}

function getConfiguredDataSourceId(): string {
  return normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
}

function buildRevalidationTargets(result: NotionWebhookResolution): { tags: string[], paths: string[] } {
  const homePath = buildInternalSlugHref(config.path || '', '')
  const pagePath = result.resolvedPagePath || ''
  const pageFallbackPath = pagePath || '/[slug]'

  if (result.eventType === 'page.content_updated') {
    return {
      tags: [...PAGE_CONTENT_REVALIDATE_TAGS],
      paths: uniqueValues([pageFallbackPath, ...PAGE_CONTENT_REVALIDATE_PATHS])
    }
  }

  if (result.eventType === 'page.properties_updated') {
    return {
      tags: [...PAGE_PROPERTIES_REVALIDATE_TAGS],
      paths: uniqueValues([homePath, pagePath, ...NOTION_WEBHOOK_REVALIDATE_PATHS])
    }
  }

  switch (result.action) {
    case 'home':
      return {
        tags: [...PAGE_PROPERTIES_REVALIDATE_TAGS],
        paths: uniqueValues([homePath, ...NOTION_WEBHOOK_REVALIDATE_PATHS])
      }
    case 'page':
      return { tags: [], paths: uniqueValues([pagePath]) }
    case 'home-and-page':
      return {
        tags: [...PAGE_PROPERTIES_REVALIDATE_TAGS],
        paths: uniqueValues([homePath, pagePath, ...NOTION_WEBHOOK_REVALIDATE_PATHS])
      }
    case 'schema':
      return {
        tags: [...NOTION_WEBHOOK_REVALIDATE_TAGS],
        paths: uniqueValues([homePath, ...NOTION_WEBHOOK_REVALIDATE_PATHS])
      }
    default:
      return { tags: [], paths: [] }
  }
}

async function resolvePageParentDataSourceId(pageId: string): Promise<string> {
  try {
    const page = await notionClient.retrievePage(pageId)
    const parentDataSourceId = getPageParentDataSourceId(page)
    infoServerEvent('notion-webhook', 'Resolved page parent data source id', {
      pageId,
      parentDataSourceId: normalizeNotionUuid(parentDataSourceId)
    })
    return parentDataSourceId
  } catch (error) {
    warnServerError('notion-webhook:resolve-parent', error, { pageId })
    return ''
  }
}

async function resolvePagePath(pageId: string): Promise<string> {
  try {
    const page = await notionClient.retrievePage(pageId)
    const resolvedPagePath = buildPagePathFromPage(page, config.path || '')
    infoServerEvent('notion-webhook', 'Resolved page path from Notion API', {
      pageId,
      resolvedPagePath
    })
    return resolvedPagePath
  } catch (error) {
    warnServerError('notion-webhook:resolve-path', error, { pageId })
    return ''
  }
}

function applyRevalidation(tags: string[], paths: string[]) {
  infoServerEvent('notion-webhook', 'Applying cache invalidation', { tags, paths })

  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }

  for (const path of paths) {
    if (path.includes('[') || path.includes(']')) {
      revalidatePath(path, 'page')
      continue
    }

    revalidatePath(path)
  }
}

function getPrewarmablePaths(paths: string[]): string[] {
  return Array.from(new Set(
    paths.filter(path => (
      typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('/api/') &&
      !path.includes('[') &&
      !path.includes(']')
    ))
  ))
}

async function prewarmPaths(origin: string, paths: string[], context: Record<string, unknown>): Promise<void> {
  if (!paths.length) {
    infoServerEvent('notion-webhook', 'Skipped prewarm because no eligible paths were found', context)
    return
  }

  const results = await Promise.allSettled(
    paths.map(async (path) => {
      const url = new URL(path, origin)
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'x-notion-webhook-prewarm': '1'
        }
      })

      return {
        path,
        status: response.status,
        ok: response.ok
      }
    })
  )

  const prewarmResults = results.map((result, index) => (
    result.status === 'fulfilled'
      ? result.value
      : {
          path: paths[index],
          status: null,
          ok: false,
          error: getErrorMessage(result.reason)
        }
  ))

  infoServerEvent('notion-webhook', 'Completed prewarm requests', {
    ...context,
    prewarmResults
  })
}

function jsonNoStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  let payload: ReturnType<typeof parseNotionWebhookPayload> = {}
  try {
    payload = parseNotionWebhookPayload(rawBody)
  } catch {
    return jsonNoStore({ error: 'Invalid JSON body' }, 400)
  }

  const configuredVerificationToken = getConfiguredVerificationToken()
  const configuredSignatureSecret = getConfiguredSignatureSecret(configuredVerificationToken)
  const requestVerificationToken = `${payload.verification_token || ''}`.trim()
  const signatureHeader = req.headers.get('x-notion-signature')
  const payloadSummary = summarizeWebhookPayload(payload)

  infoServerEvent('notion-webhook', 'Received webhook request', {
    ...payloadSummary,
    rawBodyBytes: rawBody.length,
    hasConfiguredVerificationToken: !!configuredVerificationToken,
    hasConfiguredSignatureSecret: !!configuredSignatureSecret,
    hasRequestVerificationToken: !!requestVerificationToken,
    hasSignatureHeader: !!signatureHeader,
    prewarmEnabled: shouldPrewarmWebhookPaths()
  })

  if (isNotionVerificationRequest(payload)) {
    if (configuredVerificationToken && requestVerificationToken && configuredVerificationToken !== requestVerificationToken) {
      warnServerEvent('notion-webhook', 'Rejected verification request with mismatched verification token', {
        verification: true,
        hasConfiguredVerificationToken: true,
        hasRequestVerificationToken: true
      })
      return jsonNoStore({ error: 'Invalid verification token' }, 401)
    }

    if (!configuredVerificationToken && requestVerificationToken) {
      infoServerEvent('notion-webhook', 'Received verification token from Notion. Save it to NOTION_WEBHOOK_VERIFICATION_TOKEN before enabling production refreshes.', {
        verificationTokenLength: requestVerificationToken.length,
        verificationTokenSuffix: requestVerificationToken.slice(-6)
      })
    }

    return jsonNoStore({
      ok: true,
      verification: true,
      verificationTokenReceived: !!requestVerificationToken
    })
  }

  if (configuredSignatureSecret) {
    if (!signatureHeader) {
      warnServerEvent('notion-webhook', 'Rejected webhook request due to missing signature header', {
        verification: false,
        eventType: payload.type || '',
        hasConfiguredSignatureSecret: true,
        hasSignatureHeader: false
      })
      return jsonNoStore({ error: 'Missing signature' }, 401)
    }

    if (!isValidNotionWebhookSignature(rawBody, configuredSignatureSecret, signatureHeader)) {
      warnServerEvent('notion-webhook', 'Rejected webhook request due to invalid signature', {
        verification: false,
        eventType: payload.type || '',
        hasConfiguredSignatureSecret: true,
        hasSignatureHeader: true
      })
      return jsonNoStore({ error: 'Invalid signature' }, 401)
    }
  }

  const result = await resolveNotionWebhookEvent(payload, {
    configuredDataSourceId: getConfiguredDataSourceId(),
    basePath: config.path || '',
    resolvePageParentDataSourceId,
    resolvePagePath
  })

  infoServerEvent('notion-webhook', 'Resolved webhook event', {
    ...payloadSummary,
    accepted: result.accepted,
    shouldRefresh: result.shouldRefresh,
    reason: result.reason,
    action: result.action,
    resolvedPagePath: result.resolvedPagePath
  })

  if (!result.accepted) {
    return jsonNoStore({ error: result.reason }, 400)
  }

  if (!result.shouldRefresh) {
    return jsonNoStore({
      ok: true,
      ignored: true,
      reason: result.reason,
      eventType: result.eventType,
      entityId: result.entityId
    })
  }

  const targets = buildRevalidationTargets(result)
  applyRevalidation(targets.tags, targets.paths)
  const prewarmEnabled = shouldPrewarmWebhookPaths()
  const scheduledPrewarmPaths = prewarmEnabled ? getPrewarmablePaths(targets.paths) : []

  infoServerEvent('notion-webhook', 'Resolved webhook revalidation targets', {
    ...payloadSummary,
    action: result.action,
    reason: result.reason,
    resolvedPagePath: result.resolvedPagePath,
    tags: targets.tags,
    paths: targets.paths,
    prewarmEnabled,
    scheduledPrewarmPaths,
    skippedPrewarmPaths: prewarmEnabled ? [] : getPrewarmablePaths(targets.paths)
  })

  if (prewarmEnabled) {
    void prewarmPaths(req.nextUrl.origin, scheduledPrewarmPaths, {
      ...payloadSummary,
      action: result.action,
      reason: result.reason,
      resolvedPagePath: result.resolvedPagePath
    })
  } else {
    infoServerEvent('notion-webhook', 'Skipped automatic prewarm to avoid refilling caches with stale Notion data', {
      ...payloadSummary,
      action: result.action,
      reason: result.reason,
      resolvedPagePath: result.resolvedPagePath,
      skippedPrewarmPaths: getPrewarmablePaths(targets.paths)
    })
  }

  return jsonNoStore({
    ok: true,
    revalidated: true,
    reason: result.reason,
    eventType: result.eventType,
    entityId: result.entityId,
    action: result.action,
    tags: targets.tags,
    paths: targets.paths,
    scheduledPrewarmPaths,
    timestamp: new Date().toISOString()
  })
}
