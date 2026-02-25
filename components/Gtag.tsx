'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useConfig } from '@/lib/config'
import * as gtag from '@/lib/gtag'

const Gtag = () => {
  const config = useConfig()
  const pathname = usePathname()

  useEffect(() => {
    gtag.pageview(config.analytics.gaConfig.measurementId, pathname)
  }, [config, pathname])

  return null
}

export default Gtag
