import '@jihuayu/notion-react/styles.css'
import '@/styles/globals.css'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { Metadata } from 'next'
import Script from 'next/script'
import { IBM_Plex_Sans, Noto_Serif_SC, Source_Serif_4 } from 'next/font/google'
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

const notoSerifSC = Noto_Serif_SC({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-noto-serif-sc',
  preload: false
})

const sourceSerif4 = Source_Serif_4({
  subsets: ['latin'],
  weight: ['600', '700'],
  style: ['normal'],
  display: 'swap',
  variable: '--font-source-serif-4'
})

const defaultMetadata = buildPageMetadata()

const webMcpScript = `(() => {
  const modelContext = navigator.modelContext;
  if (!modelContext) return;

  const tools = [
    {
      name: 'search_blog_posts',
      description: 'Search published posts on this blog.',
      inputSchema: {
        type: 'object',
        properties: {
          q: { type: 'string', description: 'Search query.' },
          tag: { type: 'string', description: 'Optional tag filter.' },
          limit: { type: 'integer', minimum: 1, maximum: 50, default: 10 }
        },
        required: ['q'],
        additionalProperties: false
      },
      execute: async ({ q, tag = '', limit = 10 } = {}) => {
        const params = new URLSearchParams({
          q: String(q || ''),
          limit: String(Math.max(1, Math.min(Number(limit) || 10, 50)))
        });
        if (tag) params.set('tag', String(tag));
        const response = await fetch('/api/search?' + params.toString(), {
          headers: { accept: 'application/json' }
        });
        return response.json();
      }
    },
    {
      name: 'list_blog_tags',
      description: 'List public blog tags and their post counts.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async () => {
        const response = await fetch('/api/tags', {
          headers: { accept: 'application/json' }
        });
        return response.json();
      }
    },
    {
      name: 'get_homepage_markdown',
      description: 'Return a Markdown representation of the homepage.',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false
      },
      execute: async () => {
        const response = await fetch('/', {
          headers: { accept: 'text/markdown' }
        });
        return {
          contentType: response.headers.get('content-type'),
          markdown: await response.text()
        };
      }
    }
  ];

  if (typeof modelContext.provideContext === 'function') {
    modelContext.provideContext({
      tools,
      resources: [
        { uri: '/.well-known/api-catalog', mimeType: 'application/linkset+json' },
        { uri: '/.well-known/openapi.json', mimeType: 'application/openapi+json' }
      ]
    });
  }

  if (typeof modelContext.registerTool === 'function') {
    const controller = new AbortController();
    for (const tool of tools) {
      modelContext.registerTool(tool, { signal: controller.signal });
    }
    window.addEventListener('pagehide', () => controller.abort(), { once: true });
  }
})();`

function sanitizeThemeColor(value: string, fallback: string): string {
  const normalized = `${value || ''}`.trim()
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)
    ? normalized
    : fallback
}

export const metadata: Metadata = {
  ...defaultMetadata,
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/favicon-180.png', type: 'image/png', sizes: '180x180' }]
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
  const nightBg = sanitizeThemeColor(config.darkBackground, '#0c0a09')
  const nightText = 'rgb(214, 211, 209)'
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
    <html lang={config.lang} className={cn(colorSchemeClass, ibmPlexSans.variable, notoSerifSC.variable, sourceSerif4.variable)} suppressHydrationWarning>
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
              color: rgb(55, 53, 47);
              color-scheme: light;
            }
            @media (prefers-color-scheme: dark) {
              .color-scheme-unset, .color-scheme-unset body {
                background-color: ${nightBg} !important;
                color: ${nightText};
                color-scheme: dark;
              }
              .color-scheme-unset .notion {
                color: ${nightText} !important;
              }
              .color-scheme-unset .text-black,
              .color-scheme-unset .text-gray-700,
              .color-scheme-unset .text-gray-600,
              .color-scheme-unset .text-gray-500,
              .color-scheme-unset .text-stone-900,
              .color-scheme-unset .text-stone-800,
              .color-scheme-unset .text-stone-700,
              .color-scheme-unset .text-stone-600 {
                color: ${nightText} !important;
              }
              .color-scheme-unset .fill-black {
                fill: rgb(255, 255, 255) !important;
              }
            }
          `
        }} />
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrapScript}
        </Script>
        <Script id="webmcp-tools" strategy="afterInteractive">
          {webMcpScript}
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
