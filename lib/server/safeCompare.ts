import { timingSafeEqual } from 'node:crypto'

export function safeCompareStrings(left: string, right: string): boolean {
  const normalizedLeft = `${left || ''}`
  const normalizedRight = `${right || ''}`

  if (!normalizedLeft || !normalizedRight) return false

  const leftBuffer = Buffer.from(normalizedLeft)
  const rightBuffer = Buffer.from(normalizedRight)
  if (leftBuffer.length !== rightBuffer.length) return false

  return timingSafeEqual(leftBuffer, rightBuffer)
}