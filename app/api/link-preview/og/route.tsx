import { ImageResponse } from '@vercel/og'

export const runtime = 'nodejs'

const CARD_WIDTH = 560
const CARD_HEIGHT = 440

function trimText(input: string | null, maxLength: number): string {
  const value = (input || '').trim()
  if (!value) return ''
  if (value.length <= maxLength) return value
  return `${value.slice(0, Math.max(0, maxLength - 1))}…`
}

function toDisplayUrl(rawUrl: string | null, hostname: string | null): string {
  const raw = (rawUrl || '').trim()
  if (!raw) return (hostname || '').trim()
  try {
    const parsed = new URL(raw)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.hostname}${path}`.slice(0, 120)
  } catch {
    return raw.slice(0, 120)
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)

  const hostname = trimText(searchParams.get('hostname'), 80)
  const title = trimText(searchParams.get('title'), 64) || hostname || 'Link Preview'
  const description = trimText(searchParams.get('description'), 140)
  const displayUrl = toDisplayUrl(searchParams.get('url'), hostname)

  const image = new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)',
          color: '#0f172a',
          padding: '30px 32px',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            fontSize: 52,
            lineHeight: 1.15,
            fontWeight: 700,
            letterSpacing: '-0.02em'
          }}
        >
          {title}
        </div>

        <div
          style={{
            marginTop: 18,
            fontSize: 30,
            lineHeight: 1.4,
            color: '#334155'
          }}
        >
          {description || 'No description available.'}
        </div>

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: '1px solid #94a3b8',
            fontSize: 24,
            color: '#1e293b'
          }}
        >
          {displayUrl}
        </div>
      </div>
    ),
    {
      width: CARD_WIDTH,
      height: CARD_HEIGHT
    }
  )

  image.headers.set(
    'Cache-Control',
    'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
  )

  return image
}
