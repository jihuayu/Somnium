// Notion-like sans-serif stack (system first, no heavy custom webfont bias).
export const FONTS_SANS = [
  'var(--font-ibm-plex-sans)',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  'BlinkMacSystemFont',
  '"Segoe UI Variable Display"',
  '"Segoe UI"',
  'Helvetica',
  '"PingFang SC"',
  '"Hiragino Sans GB"',
  '"Noto Sans CJK SC"',
  '"Source Han Sans SC"',
  '"Microsoft YaHei"',
  'Arial',
  '"Apple Color Emoji"',
  '"Segoe UI Emoji"',
  '"Segoe UI Symbol"',
  'sans-serif'
]

// Notion-like serif stack.
export const FONTS_SERIF = [
  '"Source Serif"',
  '"Lyon-Text"',
  'ui-serif',
  'Georgia',
  '"Times New Roman"',
  '"Songti SC"',
  '"Noto Serif CJK SC"',
  '"Source Han Serif SC"',
  'serif'
]

// Chinese reading stack.
export const FONTS_MISANS = [
  'var(--font-ibm-plex-sans)',
  '"PingFang SC"',
  '"Microsoft YaHei"',
  '"Hiragino Sans GB"',
  '"Noto Sans CJK SC"',
  '"Source Han Sans SC"',
  'ui-sans-serif',
  'system-ui',
  '-apple-system',
  '"Segoe UI"',
  'Arial',
  'sans-serif'
]

// Tailwind max-width class used by article content containers.
export const ARTICLE_CONTENT_MAX_WIDTH_CLASS = 'max-w-[50.6rem]'
// Half of the article content width, in rem, used to compute TOC horizontal anchor.
export const ARTICLE_CONTENT_HALF_WIDTH_REM = 25.3
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
