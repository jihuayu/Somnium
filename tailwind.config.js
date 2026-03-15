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

  const compiledModule = { exports: {} }
  const localRequire = createRequire(filePath)
  const execute = new Function('require', 'module', 'exports', '__dirname', '__filename', compiled.outputText)
  execute(localRequire, compiledModule, compiledModule.exports, path.dirname(filePath), filePath)
  return compiledModule.exports.default || compiledModule.exports
}

const config = loadTsConfig(path.resolve(__dirname, 'config/blog.config.ts'))

const FONTS_SANS = [
  'var(--font-ibm-plex-sans)',
  '"PingFang SC"', '"Microsoft YaHei"', '"Hiragino Sans GB"', '"Noto Sans CJK SC"',
  '"Source Han Sans SC"', '"Source Han Sans CN"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
  'Segoe UI', 'Roboto', '"Noto Sans"', '"Helvetica Neue"', 'Helvetica', '"Nimbus Sans L"',
  'Arial', '"Liberation Sans"', '"Wenquanyi Micro Hei"',
  '"WenQuanYi Zen Hei"', '"ST Heiti"', 'SimHei', '"WenQuanYi Zen Hei Sharp"', 'sans-serif'
]
const FONTS_SERIF = [
  '"Source Serif"', 'ui-serif', 'Georgia', '"Nimbus Roman No9 L"', '"Songti SC"',
  '"Noto Serif CJK SC"', '"Source Han Serif SC"', '"Source Han Serif CN"', 'STSong',
  '"AR PL New Sung"', '"AR PL SungtiL GB"', 'NSimSun', 'SimSun', '"TW-Sung"',
  '"WenQuanYi Bitmap Song"', '"AR PL UMing CN"', '"AR PL UMing HK"', '"AR PL UMing TW"',
  '"AR PL UMing TW MBE"', 'PMingLiU', 'MingLiU', 'serif'
]

module.exports = {
  content: [
    './*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './layouts/**/*.{js,ts,jsx,tsx}',
    './packages/notion-react/.storybook/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/notion-react/stories/**/*.{js,ts,jsx,tsx,mdx}',
    './packages/notion-react/src/**/*.{js,ts,jsx,tsx}'
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        day: {
          DEFAULT: config.lightBackground || '#ffffff'
        },
        night: {
          DEFAULT: config.darkBackground || '#111827'
        }
      },
      fontFamily: {
        sans: FONTS_SANS,
        serif: FONTS_SERIF,
        noEmoji: [
          '"PingFang SC"',
          '"Microsoft YaHei"',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif'
        ]
      }
    }
  },
  variants: {
    extend: {}
  },
  plugins: []
}
