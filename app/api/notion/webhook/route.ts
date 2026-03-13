import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import api from '@/lib/server/notion-api'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'
import { getPageParentDataSourceId, mapPageToPost, normalizeNotionUuid } from '@/lib/notion/postMapper'
import { config } from '@/lib/server/config'
import {
  isNotionVerificationRequest,
  isValidNotionWebhookSignature,
  parseNotionWebhookPayload,
  resolveNotionWebhookRevalidation
} from '@/lib/server/notionWebhook'

export const dynamic = 'force-dynamic'

function getConfiguredVerificationToken(): string {
  return (
    process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN?.trim() ||
    process.env.NOTION_WEBHOOK_TOKEN?.trim() ||
    ''
  )
}

function getConfiguredDataSourceId(): string {
  return normalizeNotionUuid(process.env.NOTION_DATA_SOURCE_ID)
}

async function resolvePageParentDataSourceId(pageId: string): Promise<string> {
  try {
    const page = await api.retrievePage(pageId)
    return getPageParentDataSourceId(page)
  } catch {
    return ''
  }
}

async function resolvePagePath(pageId: string): Promise<string> {
  try {
    const page = await api.retrievePage(pageId)
    const post = mapPageToPost(page)
    const slug = `${post?.slug || ''}`.trim()
    return slug ? buildInternalSlugHref(config.path || '', slug) : ''
  } catch {
    return ''
  }
}

function applyRevalidation(tags: string[], paths: string[]) {
  for (const tag of tags) {
    revalidateTag(tag, 'max')
  }

  for (const path of paths) {
    revalidatePath(path, 'page')
  }
}

function jsonNoStore(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  let payload
    = {} as ReturnType<typeof parseNotionWebhookPayload>
  try {
    payload = parseNotionWebhookPayload(rawBody)
  } catch {
    return jsonNoStore({ error: 'Invalid JSON body' }, 400)
  }

  const configuredVerificationToken = getConfiguredVerificationToken()
  const requestVerificationToken = `${payload.verification_token || ''}`.trim()
  const signatureHeader = req.headers.get('x-notion-signature')

  if (isNotionVerificationRequest(payload)) {
    if (configuredVerificationToken && requestVerificationToken && configuredVerificationToken !== requestVerificationToken) {
      return jsonNoStore({ error: 'Invalid verification token' }, 401)
    }

    if (!configuredVerificationToken && requestVerificationToken) {
      console.info('[notion-webhook] Received verification token. Save it to NOTION_WEBHOOK_VERIFICATION_TOKEN before enabling production refreshes.')
    }

    return jsonNoStore({
      ok: true,
      verification: true,
      verificationTokenReceived: !!requestVerificationToken
    })
  }

  if (!configuredVerificationToken) {
    return jsonNoStore(
      { error: 'Server is missing NOTION_WEBHOOK_VERIFICATION_TOKEN' },
      500
    )
  }

  if (!requestVerificationToken || requestVerificationToken !== configuredVerificationToken) {
    return jsonNoStore({ error: 'Unauthorized' }, 401)
  }

  if (signatureHeader && !isValidNotionWebhookSignature(rawBody, configuredVerificationToken, signatureHeader)) {
    return jsonNoStore({ error: 'Invalid signature' }, 401)
  }

  const result = await resolveNotionWebhookRevalidation(payload, {
    configuredDataSourceId: getConfiguredDataSourceId(),
    basePath: config.path || '',
    resolvePageParentDataSourceId,
    resolvePagePath
  })

  if (!result.accepted) {
    return jsonNoStore({ error: result.reason }, 400)
  }

  if (!result.shouldRevalidate) {
    return jsonNoStore({
      ok: true,
      ignored: true,
      reason: result.reason,
      eventType: result.eventType,
      entityId: result.entityId
    })
  }

  applyRevalidation(result.tags, result.paths)

  return jsonNoStore({
    ok: true,
    revalidated: true,
    reason: result.reason,
    eventType: result.eventType,
    entityId: result.entityId,
    tags: result.tags,
    paths: result.paths,
    timestamp: new Date().toISOString()
  })
}
