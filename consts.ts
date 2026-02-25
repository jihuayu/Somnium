// Preferred sans-serif font stack used across the site (first available font wins).
export const FONTS_SANS = [
  '"IBM Plex Sans"',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  'Segoe UI',
  'Roboto',
  '"Noto Sans"',
  '"Helvetica Neue"',
  'Helvetica',
  '"Nimbus Sans L"',
  'Arial',
  '"Liberation Sans"',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Noto Sans CJK SC"',
  '"Source Han Sans SC"',
  '"Source Han Sans CN"',
  '"Microsoft YaHei"',
  '"Wenquanyi Micro Hei"',
  '"WenQuanYi Zen Hei"',
  '"ST Heiti"',
  'SimHei',
  '"WenQuanYi Zen Hei Sharp"',
  'sans-serif'
]

// Preferred serif font stack used when BLOG.font is set to 'serif'.
export const FONTS_SERIF = [
  '"Source Serif"',
  'ui-serif',
  'Georgia',
  '"Nimbus Roman No9 L"',
  '"Songti SC"',
  '"Noto Serif CJK SC"',
  '"Source Han Serif SC"',
  '"Source Han Serif CN"',
  'STSong',
  '"AR PL New Sung"',
  '"AR PL SungtiL GB"',
  'NSimSun',
  'SimSun',
  '"TW-Sung"',
  '"WenQuanYi Bitmap Song"',
  '"AR PL UMing CN"',
  '"AR PL UMing HK"',
  '"AR PL UMing TW"',
  '"AR PL UMing TW MBE"',
  'PMingLiU',
  'MingLiU',
  'serif'
]

// Tailwind max-width class used by article content containers.
export const ARTICLE_CONTENT_MAX_WIDTH_CLASS = 'max-w-3xl'
// Half of the article content width, in rem, used to compute TOC horizontal anchor.
export const ARTICLE_CONTENT_HALF_WIDTH_REM = 24
// Horizontal gap between article content and TOC, in rem.
export const ARTICLE_TOC_GAP_REM = -1
// TOC panel width in pixels.
export const ARTICLE_TOC_WIDTH_PX = 260
// Computed left offset that positions TOC to the right side of centered article content.
export const ARTICLE_TOC_LEFT = `calc(50% + ${ARTICLE_CONTENT_HALF_WIDTH_REM + ARTICLE_TOC_GAP_REM}rem)`
// Distance from viewport top to TOC panel, in pixels.
export const ARTICLE_TOC_TOP_PX = 72
// Bottom safe space for TOC panel, in pixels.
export const ARTICLE_TOC_BOTTOM_PX = 24
// Maximum TOC panel height inside viewport after top/bottom offsets are applied.
export const ARTICLE_TOC_MAX_HEIGHT = `calc(100vh - ${ARTICLE_TOC_TOP_PX + ARTICLE_TOC_BOTTOM_PX}px)`
