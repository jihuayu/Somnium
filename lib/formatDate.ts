const formatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(lang: string, timezone?: string): Intl.DateTimeFormat {
  const key = `${lang}::${timezone || ''}`
  const cached = formatterCache.get(key)
  if (cached) return cached

  const formatter = new Intl.DateTimeFormat(lang, {
    dateStyle: 'medium',
    ...(timezone ? { timeZone: timezone } : {})
  })
  formatterCache.set(key, formatter)
  return formatter
}

export function formatDate(date: number | string, lang: string, timezone?: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return String(date)
  return getFormatter(lang, timezone).format(parsed)
}
