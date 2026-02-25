'use client'

import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { useConfig } from '@/lib/config'
import cn from 'classnames'
import { ReactNode } from 'react'

interface ContainerProps {
  children: ReactNode
  layout?: string
  fullWidth?: boolean
  title?: string
  description?: string
  slug?: string
  date?: string
  type?: string
  [key: string]: unknown
}

const Container = ({ children, layout, fullWidth, ...customMeta }: ContainerProps) => {
  const BLOG = useConfig()

  const meta = {
    title: BLOG.title,
    type: 'website',
    ...customMeta
  }
  return (
    <div>
      <div
        className={`wrapper ${BLOG.font === 'serif' ? 'font-serif' : 'font-sans'
          }`}
      >
        <Header
          navBarTitle={layout === 'blog' ? (meta.title as string) : null}
          fullWidth={fullWidth}
        />
        <main className={cn(
          'flex-grow transition-all',
          layout !== 'blog' && ['self-center px-4', fullWidth ? 'md:px-24' : `w-full ${ARTICLE_CONTENT_MAX_WIDTH_CLASS}`]
        )}>
          {children}
        </main>
        <Footer fullWidth={fullWidth} />
      </div>
    </div>
  )
}

export default Container
