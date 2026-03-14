const fs = require('fs')
const path = require('path')
const ts = require('typescript')
const { createRequire } = require('module')

function loadTsConfig(filePath) {
  const source = fs.readFileSync(filePath, 'utf-8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true
    },
    fileName: filePath
  })

  const module = { exports: {} }
  const localRequire = createRequire(filePath)
  const execute = new Function('require', 'module', 'exports', '__dirname', '__filename', compiled.outputText)
  execute(localRequire, module, module.exports, path.dirname(filePath), filePath)
  return module.exports.default || module.exports
}

const config = loadTsConfig(path.resolve(__dirname, 'blog.config.ts'))

module.exports = {
  siteUrl: config.link,
  generateRobotsTxt: true,
  sourceDir: '.next',
  sitemapSize: 7000,
  generateIndexSitemap: false
  // ...other options
  // https://github.com/iamvishnusankar/next-sitemap#configuration-options
}
