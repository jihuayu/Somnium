export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export const ME_PAGE_SLUG = 'me'
export const ME_GUESTBOOK_PAGE_KEY = 'me'

const MS_PER_DAY = 24 * 60 * 60 * 1000

export function getMonthInTimeZone(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getUTCMonth() + 1

  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    month: 'numeric'
  }).format(now)
  const month = Number(formatted)
  return Number.isFinite(month) && month >= 1 && month <= 12
    ? month
    : now.getUTCMonth() + 1
}

export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

export function countSiteDays({
  sinceYear,
  now,
  earliestPostDate
}: {
  sinceYear: number
  now: Date
  earliestPostDate?: number
}): number {
  const year = Number.isFinite(sinceYear) && sinceYear > 0
    ? Math.floor(sinceYear)
    : now.getUTCFullYear()
  const yearStart = Date.UTC(year, 0, 1)
  const earliest = Number(earliestPostDate || 0)
  const start = earliest > 0 && earliest < yearStart ? earliest : yearStart
  return Math.max(1, Math.floor((now.getTime() - start) / MS_PER_DAY) + 1)
}

export function padIndex(index: number, width = 2): string {
  return String(Math.max(0, Math.floor(index))).padStart(width, '0')
}

export function isExternalHref(href: string): boolean {
  return /^(https?:)?\/\//i.test(href) || href.startsWith('mailto:')
}

export type SocialIcon = 'github' | 'x' | 'mail' | 'rss' | 'link'

export function inferSocialIcon(href: string, label = ''): SocialIcon {
  const haystack = `${href} ${label}`.toLowerCase()
  if (href.startsWith('mailto:') || /mail|郵件|邮件/.test(haystack)) return 'mail'
  if (haystack.includes('github')) return 'github'
  if (/(?:^|\/\/)(?:www\.)?(?:twitter|x)\.com\b/.test(href) || label.trim() === 'X') return 'x'
  if (/\/feed\b|rss|訂閱|订阅/.test(haystack)) return 'rss'
  return 'link'
}

export function formatQuote(quote: string): string {
  const trimmed = `${quote || ''}`.trim()
  if (!trimmed) return ''
  if (/^[「『“"'`]/.test(trimmed)) return trimmed
  return `「${trimmed}」`
}

export function buildProfileMarkdown({
  name,
  tagline,
  quote,
  canonicalUrl,
  postsHeading,
  posts
}: {
  name: string
  tagline: string
  quote: string
  canonicalUrl: string
  postsHeading: string
  posts: Array<{
    title: string
    href: string
    date: string
    summary?: string
  }>
}): string {
  const postLines = posts.flatMap(post => [
    `- [${post.title}](${post.href}) — ${post.date}`,
    post.summary ? `  ${post.summary}` : ''
  ].filter(Boolean))

  return [
    `# ${name}`,
    '',
    tagline,
    '',
    quote ? `> ${quote}` : '',
    '',
    `Canonical URL: ${canonicalUrl}`,
    '',
    `## ${postsHeading}`,
    '',
    ...postLines
  ].filter(line => line !== undefined).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}
