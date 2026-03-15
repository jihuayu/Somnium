import { createHmac, timingSafeEqual } from 'node:crypto'
import { isRecord } from '../shared'
import type { NotionWebhookPayload } from '../types'

export function parseNotionWebhookPayload(rawBody: string): NotionWebhookPayload {
  const trimmed = `${rawBody || ''}`.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  return isRecord(parsed) ? parsed as NotionWebhookPayload : {}
}

export function isNotionVerificationRequest(payload: NotionWebhookPayload): boolean {
  return !!`${payload.verification_token || ''}`.trim() && !`${payload.type || ''}`.trim()
}

export function computeNotionWebhookSignature(rawBody: string, verificationToken: string): string {
  return `sha256=${createHmac('sha256', verificationToken).update(rawBody).digest('hex')}`
}

export function isValidNotionWebhookSignature(rawBody: string, secret: string, signatureHeader: string | null): boolean {
  const expectedToken = secret.trim()
  const actualSignature = `${signatureHeader || ''}`.trim()
  if (!expectedToken || !actualSignature) return false

  const computedSignature = computeNotionWebhookSignature(rawBody, expectedToken)
  const left = Buffer.from(computedSignature)
  const right = Buffer.from(actualSignature)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
