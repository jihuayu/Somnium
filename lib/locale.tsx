'use client'

import { createContext, useContext, ReactNode } from 'react'

export interface Locale {
  NAV: {
    INDEX: string
    ABOUT: string
    RSS: string
    SEARCH: string
  }
  PAGINATION: {
    PREV: string
    NEXT: string
  }
  POST: {
    BACK: string
    TOP: string
  }
  PAGE: {
    ERROR_404: {
      MESSAGE: string
    }
  }
  [key: string]: unknown
}

const LocaleContext = createContext<Locale | undefined>(undefined)

export function LocaleProvider({ value, children }: { value: Locale; children: ReactNode }) {
  return (
    <LocaleContext.Provider value={value}>
      {children}
    </LocaleContext.Provider>
  )
}

export const useLocale = (): Locale => {
  const locale = useContext(LocaleContext)
  if (!locale) throw new Error('useLocale must be used within LocaleProvider')
  return locale
}
