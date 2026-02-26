import type { ReactNode } from 'react'
import { Analytics } from '@vercel/analytics/next'

interface ClientProvidersProps {
  children: ReactNode
}

export default function ClientProviders({ children }: ClientProvidersProps) {
  return (
    <>
      {children}
      <Analytics />
    </>
  )
}
