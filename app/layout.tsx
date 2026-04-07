import '@jihuayu/notion-react/styles.css'
import '@/styles/globals.css'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Metadata } from 'next'
import Script from 'next/script'
import { IBM_Plex_Sans } from 'next/font/google'
import { config } from '@/lib/server/config'
import { buildPageMetadata } from '@/lib/server/metadata'
import { prepareDayjs } from '@/lib/dayjs'
import cn from 'classnames'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-ibm-plex-sans'
})

const defaultMetadata = buildPageMetadata()

function sanitizeThemeColor(value: string, fallback: string): string {
  const normalized = `${value || ''}`.trim()
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)
    ? normalized
    : fallback
}

export const metadata: Metadata = {
  ...defaultMetadata,
  icons: {
    icon: [
      {
        url: '/favicon-mark-light-512.png',
        type: 'image/png',
        sizes: '512x512',
        media: '(prefers-color-scheme: light)'
      },
      {
        url: '/favicon-mark-dark-512.png',
        type: 'image/png',
        sizes: '512x512',
        media: '(prefers-color-scheme: dark)'
      }
    ]
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

  const initialColorScheme: Record<string, string> = {
    auto: 'color-scheme-unset',
    dark: 'dark'
  }
  const colorSchemeClass = initialColorScheme[config.appearance] || ''

  const dayBg = sanitizeThemeColor(config.lightBackground, '#ffffff')
  const nightBg = sanitizeThemeColor(config.darkBackground, '#111827')
  const themeBootstrapScript = `(() => {
    const appearance = ${JSON.stringify(config.appearance)};
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = appearance === 'dark' || (appearance === 'auto' && media.matches);
      root.classList.toggle('dark', dark);
      root.classList.remove('color-scheme-unset');
    };
    apply();
    if (appearance !== 'auto') return;
    const onChange = () => apply();
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', onChange);
    } else if (typeof media.addListener === 'function') {
      media.addListener(onChange);
    }
  })();`

  return (
    <html lang={config.lang} className={cn(colorSchemeClass, ibmPlexSans.variable)} suppressHydrationWarning>
      <head>
        {config.appearance === 'auto' ? (
          <>
            <meta name="theme-color" content={dayBg} media="(prefers-color-scheme: light)" />
            <meta name="theme-color" content={nightBg} media="(prefers-color-scheme: dark)" />
          </>
        ) : (
          <meta name="theme-color" content={config.appearance === 'dark' ? nightBg : dayBg} />
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
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
      </head>
      <body className="bg-day dark:bg-night">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
