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

  switch (result.action) {
    case 'home':
      return { tags: [], paths: [homePath] }
    case 'page':
      return { tags: [], paths: result.resolvedPagePath ? [result.resolvedPagePath] : [] }
    case 'home-and-page':
      return { tags: [], paths: Array.from(new Set([homePath, result.resolvedPagePath].filter(Boolean))) }
    case 'schema':
      return { tags: [...NOTION_WEBHOOK_REVALIDATE_TAGS], paths: [...NOTION_WEBHOOK_REVALIDATE_PATHS] }
    default:
      return { tags: [], paths: [] }
  }
}

async function resolvePageParentDataSourceId(pageId: string): Promise<string> {
  try {
    const page = await notionClient.retrievePage(pageId)
    return getPageParentDataSourceId(page)
  } catch (error) {
    warnServerError('notion-webhook:resolve-parent', error, { pageId })
    return ''
  }
}

async function resolvePagePath(pageId: string): Promise<string> {
  try {
    const page = await notionClient.retrievePage(pageId)
    return buildPagePathFromPage(page, config.path || '')
  } catch (error) {
    warnServerError('notion-webhook:resolve-path', error, { pageId })
    return ''
  }
}

function applyRevalidation(tags: string[], paths: string[]) {
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

async function prewarmPaths(origin: string, paths: string[]): Promise<void> {
  await Promise.allSettled(
    paths.map(async (path) => {
      const url = new URL(path, origin)
      await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'x-notion-webhook-prewarm': '1'
        }
      })
    })
  )
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
      infoServerEvent('notion-webhook', `Received verification token ${requestVerificationToken}. Save it to NOTION_WEBHOOK_VERIFICATION_TOKEN before enabling production refreshes.`)
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
  const scheduledPrewarmPaths = getPrewarmablePaths(targets.paths)
  void prewarmPaths(req.nextUrl.origin, scheduledPrewarmPaths)

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
