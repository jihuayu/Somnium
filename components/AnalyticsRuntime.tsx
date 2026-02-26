'use client'

import { usePathname } from 'next/navigation'
import useAckee from 'use-ackee'

interface AnalyticsRuntimeProps {
  provider?: string
  ackeeServerUrl?: string
  ackeeDomainId?: string
}

function AckeeTracker({ serverUrl, domainId }: { serverUrl: string; domainId: string }) {
  const pathname = usePathname()
  useAckee(
    pathname,
    { server: serverUrl, domainId },
    { detailed: false, ignoreLocalhost: true }
  )
  return null
}

export default function AnalyticsRuntime({
  provider,
  ackeeServerUrl,
  ackeeDomainId
}: AnalyticsRuntimeProps) {
  if (provider === 'ackee' && ackeeServerUrl && ackeeDomainId) {
    return <AckeeTracker serverUrl={ackeeServerUrl} domainId={ackeeDomainId} />
  }

  return null
}
