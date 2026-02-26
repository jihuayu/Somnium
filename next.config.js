module.exports = {
  distDir: '.cache/next',
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
      '@/*': './*'
    }
  },
  webpack: (config) => {
    const path = require('path')
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname)
    }
    config.resolve.extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', ...config.resolve.extensions || []]
    return config
  }
}
