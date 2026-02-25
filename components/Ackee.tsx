'use client'

import { usePathname } from 'next/navigation'
import useAckee from 'use-ackee'

interface AckeeProps {
  ackeeServerUrl: string
  ackeeDomainId: string
}

const Ackee = ({ ackeeServerUrl, ackeeDomainId }: AckeeProps) => {
  const pathname = usePathname()
  useAckee(
    pathname,
    { server: ackeeServerUrl, domainId: ackeeDomainId },
    { detailed: false, ignoreLocalhost: true }
  )
  return null
}

export default Ackee
