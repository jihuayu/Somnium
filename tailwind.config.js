const fs = require('fs')
const path = require('path')

// Read blog.config.js directly
const raw = fs.readFileSync(path.resolve(__dirname, 'blog.config.js'), 'utf-8')
const config = eval(`((module = { exports: {} }) => { ${raw}; return module.exports })()`)

const FONTS_SANS = [
  '"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont',
  'Segoe UI', 'Roboto', '"Noto Sans"', '"Helvetica Neue"', 'Helvetica', '"Nimbus Sans L"',
  'Arial', '"Liberation Sans"', '"PingFang SC"', '"Hiragino Sans GB"', '"Noto Sans CJK SC"',
  '"Source Han Sans SC"', '"Source Han Sans CN"', '"Microsoft YaHei"', '"Wenquanyi Micro Hei"',
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
  content: ['./*.{js,ts,jsx,tsx}', './app/**/*.{js,ts,jsx,tsx}', './pages/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}', './layouts/**/*.{js,ts,jsx,tsx}'],
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
          '"IBM Plex Sans"',
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
