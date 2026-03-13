import cn from 'classnames'
import type { ReactNode } from 'react'
import Header from '@/components/Header'
import FooterServer from '@/components/FooterServer'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { config } from '@/lib/server/config'

export interface NavLocale {
  INDEX: string
  ABOUT: string
  RSS: string
  SEARCH: string
}

interface ContainerServerProps {
  children: ReactNode
  layout?: string
  fullWidth?: boolean
  title?: string
  navLocale: NavLocale
}

export default function ContainerServer({ children, layout, fullWidth, title, navLocale }: ContainerServerProps) {
  return (
    <div id="top">
      <div className={`wrapper ${config.font === 'serif' ? 'font-serif' : 'font-sans'}`}>
        <Header
          navBarTitle={layout === 'blog' ? title || config.title : null}
          fullWidth={fullWidth}
          siteTitle={config.title}
          siteDescription={config.description}
          path={config.path || '/'}
          showAbout={config.showAbout}
          autoCollapsedNavBar={config.autoCollapsedNavBar}
          navLocale={navLocale}
        />
        <main
          className={cn(
            'flex-grow transition-all',
            layout !== 'blog' && ['self-center px-4', fullWidth ? 'md:px-24' : `w-full ${ARTICLE_CONTENT_MAX_WIDTH_CLASS}`]
          )}
        >
          {children}
        </main>
        <FooterServer fullWidth={fullWidth} />
      </div>
    </div>
  )
}
