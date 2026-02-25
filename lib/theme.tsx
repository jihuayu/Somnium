'use client'

import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useMedia } from 'react-use'
import { useConfig } from '@/lib/config'

interface ThemeContextType {
  dark: boolean | null
}

const ThemeContext = createContext<ThemeContextType>({ dark: true })

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { appearance } = useConfig()

  const prefersDark = useMedia('(prefers-color-scheme: dark)', false)
  const dark = appearance === 'dark' || (appearance === 'auto' && prefersDark)

  useEffect(() => {
    if (typeof dark === 'boolean') {
      document.documentElement.classList.toggle('dark', dark)
      document.documentElement.classList.remove('color-scheme-unset')
    }
  }, [dark])

  return (
    <ThemeContext.Provider value={{ dark }}>
      {children}
    </ThemeContext.Provider>
  )
}

export default function useTheme(): ThemeContextType {
  return useContext(ThemeContext)
}
