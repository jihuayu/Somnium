export interface BlogConfig {
  title: string
  author: string
  email: string
  link: string
  description: string
  lang: string
  timezone: string
  appearance: 'light' | 'dark' | 'auto'
  font: 'sans-serif' | 'serif'
  lightBackground: string
  darkBackground: string
  path: string
  since: number
  postsPerPage: number
  sortByDate: boolean
  showAbout: boolean
  showMe: boolean
  showArchive: boolean
  profile: {
    greeting: string
    name: string
    tagline: string
    quote: string
    avatar?: string
    recentPostCount: number
    showGuestbook: boolean
    socials: Array<{
      label: string
      href: string
    }>
  }
  autoCollapsedNavBar: boolean
  ogImageGenerateURL: string
  socialLink: string
  linkPreview?: {
    useOgProxy: boolean
    ogProxyBaseUrl: string
  }
  notionDateMention?: {
    display: 'notion' | 'relative' | 'absolute'
    includeTime: 'auto' | 'always' | 'never'
    absoluteDateFormat: string
    absoluteDateTimeFormat: string
    relativeStyle: 'long' | 'short' | 'narrow'
  }
  seo: {
    keywords: string[]
    googleSiteVerification: string
  }
  notionDataSourceId?: string
  notionApiVersion?: string
  comment: {
    provider: '' | 'atrium'
    atriumConfig?: {
      endpoint?: string
      websiteKey?: string
    }
  }
  isProd: boolean
}
