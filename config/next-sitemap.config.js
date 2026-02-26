const fs = require('fs')
const path = require('path')
const raw = fs.readFileSync(path.resolve(__dirname, 'blog.config.js'), 'utf-8')
const config = eval(`((module = { exports: {} }) => { ${raw}; return module.exports })()`)

module.exports = {
  siteUrl: config.link,
  generateRobotsTxt: true,
  sourceDir: '.next',
  sitemapSize: 7000,
  generateIndexSitemap: false
  // ...other options
  // https://github.com/iamvishnusankar/next-sitemap#configuration-options
}
