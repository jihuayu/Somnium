const path = require('path')

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
  transpilePackages: ['dayjs'],
  turbopack: {
    resolveAlias: {
      '@': path.resolve(__dirname)
    }
  }
}
