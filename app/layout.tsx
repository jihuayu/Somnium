import 'prismjs/themes/prism.css'
import 'katex/dist/katex.min.css'
import '@/styles/globals.css'
import '@/styles/notion.css'
import { Metadata } from 'next'
import { config, clientConfig } from '@/lib/server/config'
import { buildPageMetadata } from '@/lib/server/metadata'
import loadLocale from '@/assets/i18n'
import { prepareDayjs } from '@/lib/dayjs'
import cn from 'classnames'
import cjk from '@/lib/cjk'
import { FONTS_SANS, FONTS_SERIF } from '@/consts'
import ClientProviders from './providers'

const defaultMetadata = buildPageMetadata()

export const metadata: Metadata = {
  ...defaultMetadata,
  icons: {
    icon: '/favicon.png'
  },
  alternates: {
    ...defaultMetadata.alternates,
    types: {
      'application/rss+xml': '/feed'
    }
  }
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  prepareDayjs(config.timezone)
  const locale = await loadLocale('basic', config.lang)

  const initialColorScheme: Record<string, string> = {
    auto: 'color-scheme-unset',
    dark: 'dark'
  }
  const colorSchemeClass = initialColorScheme[config.appearance] || ''

  const CJK = cjk(config)
  const isSerif = config.font === 'serif'
  const fontType = isSerif ? 'Serif' : 'Sans'
  const isCJK = ['zh', 'ja', 'ko'].includes(config.lang.slice(0, 2).toLocaleLowerCase())

  const dayBg = config.lightBackground || '#ffffff'
  const nightBg = config.darkBackground || '#111827'

  return (
    <html lang={config.lang} className={cn(colorSchemeClass)} suppressHydrationWarning>
      <head>
        {isSerif ? (
          <>
            <link rel="preload" href="/fonts/SourceSerif.var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            <link rel="preload" href="/fonts/SourceSerif-Italic.var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          </>
        ) : (
          <>
            <link rel="preload" href="/fonts/IBMPlexSansVar-Roman.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
            <link rel="preload" href="/fonts/IBMPlexSansVar-Italic.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
          </>
        )}
        {isCJK && CJK && (
          <>
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
            <link
              rel="preload"
              as="style"
              href={`https://fonts.googleapis.com/css2?family=Noto+${fontType}+${CJK}:wght@400;500;700&display=swap`}
            />
            <link
              rel="stylesheet"
              href={`https://fonts.googleapis.com/css2?family=Noto+${fontType}+${CJK}:wght@400;500;700&display=swap`}
            />
          </>
        )}
        {config.appearance === 'auto' ? (
          <>
            <meta name="theme-color" content={config.lightBackground} media="(prefers-color-scheme: light)" />
            <meta name="theme-color" content={config.darkBackground} media="(prefers-color-scheme: dark)" />
          </>
        ) : (
          <meta name="theme-color" content={config.appearance === 'dark' ? config.darkBackground : config.lightBackground} />
        )}
        <style dangerouslySetInnerHTML={{
          __html: `
            .color-scheme-unset, .color-scheme-unset body {
              background-color: ${dayBg} !important;
            }
            @media (prefers-color-scheme: dark) {
              .color-scheme-unset, .color-scheme-unset body {
                background-color: ${nightBg} !important;
              }
            }
          `
        }} />
      </head>
      <body className="bg-day dark:bg-night">
        <ClientProviders config={clientConfig} locale={locale}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
