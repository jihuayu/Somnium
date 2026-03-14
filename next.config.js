const path = require('path')

const notionReactAliases = {
  '@': path.resolve(__dirname),
  '@jihuayu/notion-react': path.resolve(__dirname, 'packages/notion-react/src/index.ts'),
  '@jihuayu/notion-react/normalize': path.resolve(__dirname, 'packages/notion-react/src/normalize.ts'),
  '@jihuayu/notion-react/rss': path.resolve(__dirname, 'packages/notion-react/src/rss.ts'),
  '@jihuayu/notion-react/og': path.resolve(__dirname, 'packages/notion-react/src/og.ts'),
  '@jihuayu/notion-react/styles.css': path.resolve(__dirname, 'packages/notion-react/src/styles.css')
}

module.exports = {
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
      }
    ]
  },
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: notionReactAliases
  }
}
