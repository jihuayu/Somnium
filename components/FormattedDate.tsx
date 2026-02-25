'use client'

import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import { useConfig } from '@/lib/config'

dayjs.extend(localizedFormat)

const loaded: Record<string, boolean | Promise<void>> = {}

interface FormattedDateProps {
  date: number | string
}

export default function FormattedDate({ date }: FormattedDateProps) {
  const lang = useConfig().lang.slice(0, 2)
  const [isLocaleLoaded, setIsLocaleLoaded] = useState(loaded[lang] === true)

  useEffect(() => {
    if (!isLocaleLoaded) {
      loaded[lang] ??= import(`dayjs/locale/${lang}.js`).then(
        () => {
          loaded[lang] = true
          dayjs.locale(lang)
        },
        () => console.warn(`dayjs locale \`${lang}\` not found`)
      )
      ;(loaded[lang] as Promise<void>).then(() => setIsLocaleLoaded(true))
    }
  }, [isLocaleLoaded, lang])

  return <span suppressHydrationWarning>{dayjs(date).format('ll')}</span>
}
