function isIpv4(hostname: string): boolean {
  const parts = hostname.split('.')
  if (parts.length !== 4) return false
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return false
    const value = Number(part)
    if (!Number.isInteger(value) || value < 0 || value > 255) return false
  }
  return true
}

function isIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase()
  if (!normalized.includes(':')) return false
  return /^[0-9a-f:.]+$/.test(normalized)
}

export function getHostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

export function isPrivateHostname(hostname: string): boolean {
  if (!hostname) return true
  if (hostname === 'localhost') return true
  if (hostname.endsWith('.local')) return true

  if (isIpv4(hostname)) {
    if (hostname.startsWith('10.')) return true
    if (hostname.startsWith('127.')) return true
    if (hostname.startsWith('192.168.')) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true
    if (hostname.startsWith('169.254.')) return true
  }

  if (isIpv6(hostname)) {
    const lower = hostname.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  }

  return false
}
