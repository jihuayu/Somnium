import path from 'path'
import type { NextConfig } from 'next'
import { AGENT_DISCOVERY_LINK_HEADER } from './lib/agent-discovery'

// Matches requests that explicitly accept Markdown (agent-facing content negotiation).
const markdownAccept = {
  type: 'header',
  key: 'accept',
  value: '.*text/markdown.*'
} as const

// HTML page paths: everything except API routes, Next internals, well-known
// endpoints, the feed and static files with an extension.
const HTML_PAGE_SOURCE = '/((?!api/|_next/|\\.well-known/|feed$|.*\\.[^/]*$).*)'

const nextConfig: NextConfig = {
  typescript: {
    tsconfigPath: './tsconfig.build.json'
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'gravatar.com',
        pathname: '/**'
      }
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*{/}?',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'interest-cohort=()'
          }
        ]
      },
      // Agent discovery header for HTML pages. Markdown responses are excluded
      // here because the /.well-known/home.md route sets its own Link header.
      // Serving this from routing config (instead of proxy.ts) keeps requests
      // out of middleware, so cached pages are answered directly by the CDN.
      {
        source: HTML_PAGE_SOURCE,
        missing: [markdownAccept],
        headers: [
          {
            key: 'Link',
            value: AGENT_DISCOVERY_LINK_HEADER
          }
        ]
      },
      // Favicons are referenced on every page; without this they are
      // revalidated on each visit (public assets default to max-age=0).
      {
        source: '/(favicon[^/]*\\.png)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=604800'
          }
        ]
      }
    ]
  },
  async rewrites() {
    // beforeFiles is required: plain rewrites run after the filesystem phase,
    // so they would never fire for statically matched routes like `/`.
    return {
      beforeFiles: [
        {
          source: '/',
          has: [markdownAccept],
          destination: '/.well-known/home.md'
        },
        {
          source: '/page/:path*',
          has: [markdownAccept],
          destination: '/.well-known/home.md/page/:path*'
        },
        {
          source: '/tag/:path*',
          has: [markdownAccept],
          destination: '/.well-known/home.md/tag/:path*'
        },
        {
          source: '/search',
          has: [markdownAccept],
          destination: '/.well-known/home.md/search'
        },
        {
          source: '/:slug((?!api|feed|docs|_next|.*\\..*).*)',
          has: [markdownAccept],
          destination: '/.well-known/home.md/:slug'
        }
      ]
    }
  },
  turbopack: {
    root: path.resolve(__dirname)
  }
}

export default nextConfig
