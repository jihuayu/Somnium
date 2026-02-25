'use client'

import { createContext, useContext, ReactNode } from 'react'

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
    provider: string
    gitalkConfig: {
      repo: string
      owner: string
      admin: string[]
      clientID: string
      clientSecret: string
      distractionFreeMode: boolean
    }
    utterancesConfig: {
      repo: string
    }
    cusdisConfig: {
      appId: string
      host: string
      scriptSrc: string
    }
  }
  isProd: boolean
}

const ConfigContext = createContext<BlogConfig | undefined>(undefined)

export function ConfigProvider({ value, children }: { value: BlogConfig; children: ReactNode }) {
  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  )
}

export function useConfig(): BlogConfig {
  const config = useContext(ConfigContext)
  if (!config) throw new Error('useConfig must be used within ConfigProvider')
  return config
}
