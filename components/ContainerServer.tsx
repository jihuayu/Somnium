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
  title?: string
}

export default async function ContainerServer({ children, layout, fullWidth, title }: ContainerServerProps) {
  const hideHeader = layout === 'me'
  const locale = hideHeader ? null : await loadLocale('basic', config.lang)
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS

  return (
    <div id="top">
      <div className={`wrapper ${config.font === 'serif' ? 'font-serif' : 'font-sans'}`}>
        {!hideHeader && locale ? (
          <Header
            navBarTitle={layout === 'blog' ? title || config.title : null}
            fullWidth={fullWidth}
            siteTitle={config.title}
            siteDescription={config.description}
            path={config.path || '/'}
            showMe={config.showMe}
            showAbout={config.showAbout}
            autoCollapsedNavBar={config.autoCollapsedNavBar}
            navLocale={locale.NAV}
          />
        ) : null}
        <main
          className={cn(
            'flex-grow transition-all',
            layout === 'me' && 'w-full',
            layout !== 'blog' && layout !== 'me' && ['self-center w-full px-4', contentWidthClass]
          )}
        >
          {children}
        </main>
        <FooterServer fullWidth={fullWidth} />
      </div>
    </div>
  )
}
