import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath, revalidateTag } from 'next/cache'
import {
  applyAtriumCacheRevalidation,
  buildAtriumCacheRevalidationTargets,
  parseAtriumCacheRevalidateNotification
} from '@/lib/server/cacheRevalidation'
import { safeCompareStrings } from '@/lib/server/safeCompare'

export const dynamic = 'force-dynamic'

function json(value: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(value, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  })
}

function getServerToken(): string {
  return String(process.env.CACHE_REVALIDATE_TOKEN || '').trim()
}

function parseBearerToken(value: string | null): string {
  if (!value) return ''
  const match = /^Bearer\s+(.+)$/i.exec(value.trim())
  return match ? match[1].trim() : ''
}

async function parseBody(req: NextRequest): Promise<unknown> {
  const text = await req.text()
  if (!text.trim()) throw new Error('Invalid callback body')

  try {
    return JSON.parse(text)
  } catch {
    throw new Error('Invalid JSON body')
  }
}

export async function GET(): Promise<NextResponse> {
  return json({ error: 'Method Not Allowed' }, 405)
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const serverToken = getServerToken()
  if (!serverToken) {
    return json({ error: 'Server is missing CACHE_REVALIDATE_TOKEN' }, 500)
  }

  const token = parseBearerToken(req.headers.get('authorization'))
  if (!token || !safeCompareStrings(token, serverToken)) {
    return json({ error: 'Unauthorized' }, 401)
  }

  let notification
  try {
    notification = parseAtriumCacheRevalidateNotification(await parseBody(req))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Invalid callback body' }, 400)
  }

  applyAtriumCacheRevalidation(
    buildAtriumCacheRevalidationTargets(notification),
    { revalidateTag, revalidatePath }
  )

  return json({
    ok: true,
    notificationId: notification.notificationId,
    revision: notification.revision
  })
}
