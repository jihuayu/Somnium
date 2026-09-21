import { createHmac, timingSafeEqual } from 'node:crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const MAX_BODY_BYTES = 1024 * 1024
const RELAY_KEY_CONTEXT = 'somnium:notion-webhook-relay:v1'

function json(value: Record<string, unknown>, status: number): Response {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } })
}

export async function GET(): Promise<Response> {
  return new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } })
}

export async function POST(req: Request): Promise<Response> {
  const notionSecret = process.env.NOTION_WEBHOOK_SIGNATURE_SECRET?.trim()
    || process.env.NOTION_WEBHOOK_VERIFICATION_TOKEN?.trim()
    || process.env.NOTION_WEBHOOK_TOKEN?.trim()
  const callbackSecret = process.env.CACHE_REVALIDATE_TOKEN?.trim()
  if (!notionSecret || !callbackSecret) return json({ error: 'Webhook proxy is not configured' }, 503)

  let target: URL
  try {
    const base = process.env.ATRIUM_BLOG_API_URL?.trim()
    if (!base) throw new Error('Missing upstream')
    target = new URL(`${base.replace(/\/$/, '')}/webhooks/notion`)
    if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash
      || target.origin === new URL(req.url).origin) throw new Error('Invalid upstream')
  } catch {
    return json({ error: 'Webhook proxy is not configured' }, 503)
  }

  const signature = req.headers.get('x-notion-signature')?.trim() || ''
  if (!/^sha256=[a-f0-9]{64}$/.test(signature)) return json({ error: 'Invalid signature' }, 401)
  // Preserve the exact signed bytes, including whitespace and UTF-8 encoding.
  const chunks: Uint8Array[] = []
  let length = 0
  const reader = req.body?.getReader()
  try {
    if (reader) {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        length += value.byteLength
        if (length > MAX_BODY_BYTES) {
          await reader.cancel()
          return json({ error: 'Webhook body is too large' }, 413)
        }
        chunks.push(value)
      }
    }
  } catch {
    return json({ error: 'Could not read webhook body' }, 400)
  }
  const body = Buffer.concat(chunks)
  const expected = `sha256=${createHmac('sha256', notionSecret).update(body).digest('hex')}`
  if (!timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return json({ error: 'Invalid signature' }, 401)
  }
  // Keep the original secret in Vercel; use a domain-separated relay key.
  const relaySecret = createHmac('sha256', callbackSecret).update(RELAY_KEY_CONTEXT).digest('hex')
  const relaySignature = `sha256=${createHmac('sha256', relaySecret).update(body).digest('hex')}`
  try {
    const response = await fetch(target, {
      method: 'POST', body,
      headers: { 'Content-Type': 'application/json', 'X-Notion-Signature': relaySignature },
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(10_000)
    })
    // A redirect is not a durable acknowledgement. Never send signed data to
    // another origin. Non-2xx stays non-2xx so Notion can retry delivery.
    if (response.status >= 300 && response.status < 400) {
      return json({ error: 'Webhook upstream redirected' }, 502)
    }
    const headers = new Headers({ 'Cache-Control': 'no-store' })
    headers.set('Content-Type', response.headers.get('content-type') || 'application/json')
    const retryAfter = response.headers.get('retry-after')
    if (retryAfter) headers.set('Retry-After', retryAfter)
    const result = await response.arrayBuffer()
    return new Response(response.status === 204 ? null : result, { status: response.status, headers })
  } catch (error) {
    return json({ error: 'Webhook upstream unavailable' },
      error instanceof Error && error.name === 'TimeoutError' ? 504 : 502)
  }
}
