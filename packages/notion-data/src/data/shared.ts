import type { NotionFieldNameInput, ResolvableString } from './types'

export const API_BASE_URL = 'https://api.notion.com/v1'
export const DEFAULT_API_VERSION = '2025-09-03'
export const DEFAULT_MAX_RETRIES = 3
export const DEFAULT_BLOCK_FETCH_CONCURRENCY = 6

export function resolveConfigString(value: ResolvableString | undefined, fallback = ''): string {
  if (typeof value === 'function') {
    return `${value() || ''}`.trim() || fallback
  }
  return `${value || ''}`.trim() || fallback
}

export function getRequiredValue(name: string, value: ResolvableString | undefined): string {
  const resolved = resolveConfigString(value)
  if (!resolved) {
    throw new Error(`Missing required configuration: ${name}`)
  }
  return resolved
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function normalizeErrorMessage(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `Notion request failed with status ${status}`
  const message = (payload as { message?: unknown }).message
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : `Notion request failed with status ${status}`
}

export function unique(values: readonly string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function getPlainTextFromDirectoryRichText(items: Array<{ plain_text?: string | null }> = []): string {
  return items.map(item => `${item?.plain_text || ''}`).join('').trim()
}

export function toFieldNameList(fieldNames: NotionFieldNameInput): string[] {
  return (Array.isArray(fieldNames) ? fieldNames : [fieldNames])
    .map(fieldName => `${fieldName || ''}`.trim())
    .filter(Boolean)
}
