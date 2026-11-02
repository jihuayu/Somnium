import cn from 'classnames'
import type { ReactNode } from 'react'
import Header from '@/components/Header'
import FooterServer from '@/components/FooterServer'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS, ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { config } from '@/lib/server/config'
import loadLocale from '@/assets/i18n'

interface ContainerServerProps {
  children: ReactNode
  layout?: string
  fullWidth?: boolean
  home?: boolean
}

export default async function ContainerServer({ children, layout, fullWidth, home }: ContainerServerProps) {
  const locale = await loadLocale('basic', config.lang)
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS

  return (
    <div id="top">
      <div className={`wrapper ${config.font === 'serif' ? 'font-serif' : 'font-sans'}`}>
        <Header
          siteTitle={config.title}
          siteDescription={home ? config.description : undefined}
          path={config.path || '/'}
          showAbout={config.showAbout}
          navLocale={locale.NAV}
        />
        <main
          className={cn(
            'flex-grow min-w-0',
            layout !== 'blog' && ['self-center w-full px-5', contentWidthClass]
          )}
        >
          {children}
        </main>
        <FooterServer fullWidth={fullWidth} />
      </div>
    </div>
  )
}
