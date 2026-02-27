import net from 'node:net'

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

  const ipVersion = net.isIP(hostname)
  if (ipVersion === 4) {
    if (hostname.startsWith('10.')) return true
    if (hostname.startsWith('127.')) return true
    if (hostname.startsWith('192.168.')) return true
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)) return true
    if (hostname.startsWith('169.254.')) return true
  }

  if (ipVersion === 6) {
    const lower = hostname.toLowerCase()
    if (lower === '::1') return true
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  }

  return false
}
