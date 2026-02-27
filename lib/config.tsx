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
  showArchive: boolean
  autoCollapsedNavBar: boolean
  ogImageGenerateURL: string
  socialLink: string
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
  analytics: {
    provider: string
    ackeeConfig: {
      tracker: string
      dataAckeeServer: string
      domainId: string
    }
    gaConfig: {
      measurementId: string
    }
  }
  comment: {
    provider: '' | 'utterances'
    utterancesConfig: {
      repo: string
    }
  }
  isProd: boolean
}
