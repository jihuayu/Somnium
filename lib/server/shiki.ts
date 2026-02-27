import { createHighlighter, type BundledLanguage, type Highlighter, type SpecialLanguage } from 'shiki'
import { createHash } from 'node:crypto'

export interface HighlightedCode {
  html: string
  language: string
  displayLanguage: string
}

const SHIKI_LANGUAGE_ALIASES: Record<string, BundledLanguage | 'plaintext'> = {
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  jsx: 'jsx',
  tsx: 'tsx',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  md: 'markdown',
  sh: 'bash',
  shell: 'bash',
  shellscript: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  golang: 'go',
  csharp: 'csharp',
  cs: 'csharp',
  kt: 'kotlin',
  plain: 'plaintext',
  plaintext: 'plaintext',
  text: 'plaintext',
  txt: 'plaintext',
  markup: 'html'
}

const SHIKI_LANGUAGES: Array<BundledLanguage | SpecialLanguage> = [
  'plaintext',
  'html',
  'xml',
  'css',
  'javascript',
  'typescript',
  'jsx',
  'tsx',
  'json',
  'bash',
  'yaml',
  'markdown',
  'python',
  'go',
  'java',
  'rust',
  'sql',
  'diff',
  'toml',
  'ruby',
  'csharp',
  'kotlin'
]

const SHIKI_LANGUAGE_SET = new Set<string>(SHIKI_LANGUAGES as string[])
const SHIKI_HIGHLIGHT_CACHE_MAX_ENTRIES = 512

let highlighterPromise: Promise<Highlighter> | null = null
const highlightHtmlCache = new Map<string, { html: string, language: string }>()

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: SHIKI_LANGUAGES
    })
  }

  return highlighterPromise
}

export function normalizeCodeLanguage(rawLanguage: string): string {
  const lower = `${rawLanguage || ''}`.trim().toLowerCase()
  if (!lower) return ''
  return SHIKI_LANGUAGE_ALIASES[lower] || lower
}

function escapeHtml(input: string): string {
  return `${input || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function renderFallbackHtml(source: string): string {
  return `<pre class="shiki shiki-themes github-light github-dark" style="color:#24292e;background-color:#fff;--shiki-light:#24292e;--shiki-light-bg:#fff;--shiki-dark:#e1e4e8;--shiki-dark-bg:#24292e"><code>${escapeHtml(source)}</code></pre>`
}

function buildHighlightCacheKey(source: string, language: string): string {
  const hash = createHash('sha1').update(source).digest('hex')
  return `${language}:${hash}`
}

function readHighlightCache(key: string): { html: string, language: string } | null {
  const value = highlightHtmlCache.get(key)
  if (!value) return null

  // Refresh recency for simple LRU behavior.
  highlightHtmlCache.delete(key)
  highlightHtmlCache.set(key, value)
  return value
}

function writeHighlightCache(key: string, value: { html: string, language: string }) {
  if (highlightHtmlCache.size >= SHIKI_HIGHLIGHT_CACHE_MAX_ENTRIES) {
    const oldestKey = highlightHtmlCache.keys().next().value
    if (typeof oldestKey === 'string' && oldestKey) {
      highlightHtmlCache.delete(oldestKey)
    }
  }
  highlightHtmlCache.set(key, value)
}

export async function highlightCodeToHtml(source: string, rawLanguage: string): Promise<HighlightedCode> {
  const displayLanguage = `${rawLanguage || ''}`.trim() || 'plain text'
  const normalized = normalizeCodeLanguage(rawLanguage)
  const language = SHIKI_LANGUAGE_SET.has(normalized) ? normalized : 'plaintext'
  const cacheKey = buildHighlightCacheKey(source, language)
  const cached = readHighlightCache(cacheKey)
  if (cached) {
    return {
      html: cached.html,
      language: cached.language,
      displayLanguage
    }
  }

  if (!source) {
    const result = {
      html: renderFallbackHtml(''),
      language,
      displayLanguage
    }
    writeHighlightCache(cacheKey, { html: result.html, language: result.language })
    return result
  }

  try {
    const highlighter = await getHighlighter()
    const html = highlighter.codeToHtml(source, {
      lang: language as BundledLanguage | SpecialLanguage,
      themes: {
        light: 'github-light',
        dark: 'github-dark'
      }
    })

    const result = {
      html,
      language,
      displayLanguage
    }
    writeHighlightCache(cacheKey, { html: result.html, language: result.language })
    return result
  } catch {
    const result = {
      html: renderFallbackHtml(source),
      language: 'plaintext',
      displayLanguage
    }
    writeHighlightCache(cacheKey, { html: result.html, language: result.language })
    return result
  }
}
