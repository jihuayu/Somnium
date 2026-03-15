import { createHmac, timingSafeEqual } from 'node:crypto'
import { isRecord } from '../shared'
import type { NotionWebhookPayload } from '../types'

/**
 * EN: Parses raw webhook body into a structured payload.
 * ZH: 将 webhook 原始请求体解析为结构化载荷。
 */
export function parseNotionWebhookPayload(rawBody: string): NotionWebhookPayload {
  const trimmed = `${rawBody || ''}`.trim()
  if (!trimmed) return {}
  const parsed = JSON.parse(trimmed)
  return isRecord(parsed) ? parsed as NotionWebhookPayload : {}
}

/**
 * EN: Detects Notion verification requests.
 * ZH: 判断是否为 Notion 验证请求。
 */
export function isNotionVerificationRequest(payload: NotionWebhookPayload): boolean {
  return !!`${payload.verification_token || ''}`.trim() && !`${payload.type || ''}`.trim()
}

/**
 * EN: Computes HMAC SHA256 signature for Notion webhook body.
 * ZH: 计算 Notion webhook 请求体的 HMAC SHA256 签名。
 */
export function computeNotionWebhookSignature(rawBody: string, verificationToken: string): string {
  return `sha256=${createHmac('sha256', verificationToken).update(rawBody).digest('hex')}`
}

/**
 * EN: Validates webhook signature using timing-safe compare.
 * ZH: 使用时序安全比较校验 webhook 签名。
 */
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
