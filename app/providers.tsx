'use client'

import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { ConfigProvider, BlogConfig } from '@/lib/config'
import { LocaleProvider, Locale } from '@/lib/locale'
import { ThemeProvider } from '@/lib/theme'
import Scripts from '@/components/Scripts'
import { Analytics } from '@vercel/analytics/next'

const Ackee = dynamic(() => import('@/components/Ackee'), { ssr: false })
const Gtag = dynamic(() => import('@/components/Gtag'), { ssr: false })

interface ClientProvidersProps {
  config: BlogConfig
  locale: Locale
  children: ReactNode
}

export default function ClientProviders({ config, locale, children }: ClientProvidersProps) {
  return (
    <ConfigProvider value={config}>
      <Scripts />
      <LocaleProvider value={locale}>
        <ThemeProvider>
          <>
            {process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' && config?.analytics?.provider === 'ackee' && (
              <Ackee
                ackeeServerUrl={config.analytics.ackeeConfig.dataAckeeServer}
                ackeeDomainId={config.analytics.ackeeConfig.domainId}
              />
            )}
            {process.env.NEXT_PUBLIC_VERCEL_ENV === 'production' && config?.analytics?.provider === 'ga' && <Gtag />}
            {children}
            <Analytics />
          </>
        </ThemeProvider>
      </LocaleProvider>
    </ConfigProvider>
  )
}
