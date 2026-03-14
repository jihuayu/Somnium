import { isIP } from 'node:net'

const LOCAL_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain'
])

function normalizeHostname(hostname: string): string {
  return `${hostname || ''}`
    .trim()
    .replace(/^\[(.*)\]$/g, '$1')
    .replace(/\.+$/g, '')
    .toLowerCase()
}

function isPrivateIpv4Address(hostname: string): boolean {
  const octets = hostname.split('.').map(part => Number(part))
  if (octets.length !== 4 || octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }

  const [first, second] = octets

  if (first === 0 || first === 10 || first === 127) return true
  if (first === 100 && second >= 64 && second <= 127) return true
  if (first === 169 && second === 254) return true
  if (first === 172 && second >= 16 && second <= 31) return true
  if (first === 192 && second === 168) return true
  if (first === 198 && (second === 18 || second === 19)) return true
  if (first >= 224) return true

  return false
}

function isPrivateIpv6Address(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  if (!normalized || normalized === '::' || normalized === '::1') return true

  if (normalized.startsWith('::ffff:')) {
    return isPrivateIpv4Address(normalized.slice('::ffff:'.length))
  }

  const [firstSegment = ''] = normalized.split(':')
  const firstHextet = Number.parseInt(firstSegment || '0', 16)
  if (Number.isNaN(firstHextet)) return true

  if ((firstHextet & 0xfe00) === 0xfc00) return true
  if ((firstHextet & 0xffc0) === 0xfe80) return true

  return false
}

export function normalizeHttpUrl(rawUrl: string): URL | null {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function isPrivateHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname)
  if (!normalized) return true

  if (LOCAL_HOSTNAMES.has(normalized)) return true
  if (normalized.endsWith('.local') || normalized.endsWith('.localhost')) return true

  const ipVersion = isIP(normalized)
  if (ipVersion === 4) return isPrivateIpv4Address(normalized)
  if (ipVersion === 6) return isPrivateIpv6Address(normalized)

  return false
}

export function parsePublicHttpUrl(rawUrl: string): URL | null {
  const parsed = normalizeHttpUrl(rawUrl)
  if (!parsed) return null
  return isPrivateHostname(parsed.hostname) ? null : parsed
}

export function isPublicHttpUrl(rawUrl: string): boolean {
  return !!parsePublicHttpUrl(rawUrl)
}

export function getHostnameFromUrl(url: string): string {
  return normalizeHttpUrl(url)?.hostname.toLowerCase() || ''
}
