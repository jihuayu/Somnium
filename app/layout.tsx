import 'prismjs/themes/prism.css'
import 'katex/dist/katex.min.css'
import '@/styles/globals.css'
import '@/styles/notion.css'
import { Metadata } from 'next'
import Script from 'next/script'
import { config, clientConfig } from '@/lib/server/config'
import { buildPageMetadata } from '@/lib/server/metadata'
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
  const analyticsEnabled = process.env.NODE_ENV === 'production'
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
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
      </head>
      <body className="bg-day dark:bg-night">
        {analyticsEnabled && config.analytics?.provider === 'ackee' && (
          <Script
            id="ackee-tracker"
            src={config.analytics.ackeeConfig.tracker}
            data-ackee-server={config.analytics.ackeeConfig.dataAckeeServer}
            data-ackee-domain-id={config.analytics.ackeeConfig.domainId}
            strategy="lazyOnload"
          />
        )}
        {analyticsEnabled && config.analytics?.provider === 'ga' && (
          <>
            <Script
              id="ga-script"
              src={`https://www.googletagmanager.com/gtag/js?id=${config.analytics.gaConfig.measurementId}`}
              strategy="lazyOnload"
            />
            <Script id="ga-init" strategy="lazyOnload">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                window.gtag = gtag;
                gtag('js', new Date());
                gtag('config', '${config.analytics.gaConfig.measurementId}', { send_page_view: false });
                var __gaLastPath = '';
                var __gaPagePath = function() {
                  return window.location.pathname + window.location.search;
                };
                var __gaSendPageView = function() {
                  var nextPath = __gaPagePath();
                  if (__gaLastPath === nextPath) return;
                  __gaLastPath = nextPath;
                  gtag('config', '${config.analytics.gaConfig.measurementId}', { page_path: nextPath });
                };
                __gaSendPageView();
                var __gaDispatchLocationChange = function() {
                  window.dispatchEvent(new Event('locationchange'));
                };
                var __gaPushState = history.pushState;
                history.pushState = function() {
                  var result = __gaPushState.apply(this, arguments);
                  __gaDispatchLocationChange();
                  return result;
                };
                var __gaReplaceState = history.replaceState;
                history.replaceState = function() {
                  var result = __gaReplaceState.apply(this, arguments);
                  __gaDispatchLocationChange();
                  return result;
                };
                window.addEventListener('popstate', __gaDispatchLocationChange);
                window.addEventListener('locationchange', __gaSendPageView);`}
            </Script>
          </>
        )}
        <ClientProviders config={clientConfig}>
          {children}
        </ClientProviders>
      </body>
    </html>
  )
}
