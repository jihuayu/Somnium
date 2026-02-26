import type { ReactNode } from 'react'
import type { BlogConfig } from '@/lib/config'
import { Analytics } from '@vercel/analytics/next'
import AnalyticsRuntime from '@/components/AnalyticsRuntime'

interface ClientProvidersProps {
  config: BlogConfig
  children: ReactNode
}

export default function ClientProviders({ config, children }: ClientProvidersProps) {
  const analyticsEnabled = process.env.NODE_ENV === 'production'

  return (
    <>
      {analyticsEnabled && config?.analytics?.provider === 'ackee' && (
        <AnalyticsRuntime
          provider={config?.analytics?.provider}
          ackeeServerUrl={config?.analytics?.ackeeConfig?.dataAckeeServer}
          ackeeDomainId={config?.analytics?.ackeeConfig?.domainId}
        />
      )}
      {children}
      <Analytics />
    </>
  )
}
