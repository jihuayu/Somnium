import 'server-only'

const CHINA_COUNTRY_CODE = 'CN'

export function normalizeCountryCode(countryCode?: string | null): string {
  return `${countryCode || ''}`.trim().toUpperCase()
}

export function shouldHideCommentsForRequest(requestHeaders: Pick<Headers, 'get'>): boolean {
  return normalizeCountryCode(requestHeaders.get('x-vercel-ip-country')) === CHINA_COUNTRY_CODE
}
