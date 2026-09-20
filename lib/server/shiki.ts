import { createHighlighter, type BundledLanguage, type Highlighter, type SpecialLanguage } from 'shiki'
import { createHash } from 'node:crypto'
import { warnServerError } from '@/lib/server/logging'

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
  'bash',
  'css',
  'diff',
  'html',
  'javascript',
  'json',
  'jsx',
  'markdown',
  'python',
  'tsx',
  'typescript',
  'yaml',
  'go',
  'rust',
  'sql'
]

// Optional but commonly-seen extended languages; kept light to reduce cold-start overhead.
const SHIKI_EXTENDED_LANGUAGES: Array<BundledLanguage | SpecialLanguage> = [
  'xml',
  'toml',
  'java',
  'ruby',
  'csharp',
  'kotlin'
]

const SHIKI_LANGUAGE_SET = new Set<string>(SHIKI_LANGUAGES as string[])
const SHIKI_EXTENDED_LANGUAGE_SET = new Set<string>(SHIKI_EXTENDED_LANGUAGES as string[])
const SHIKI_HIGHLIGHT_CACHE_MAX_ENTRIES = 512

let baseHighlighterPromise: Promise<Highlighter> | null = null
let extendedHighlighterPromise: Promise<Highlighter> | null = null
const highlightHtmlCache = new Map<string, { html: string, language: string }>()

function getBaseHighlighter(): Promise<Highlighter> {
  if (!baseHighlighterPromise) {
    baseHighlighterPromise = createHighlighter({
      themes: ['vitesse-light', 'vitesse-dark'],
      langs: [...SHIKI_LANGUAGES]
    })
  }

  return baseHighlighterPromise
}

function getExtendedHighlighter(): Promise<Highlighter> {
  if (!extendedHighlighterPromise) {
    extendedHighlighterPromise = createHighlighter({
      themes: ['vitesse-light', 'vitesse-dark'],
      langs: [...SHIKI_LANGUAGES, ...SHIKI_EXTENDED_LANGUAGES]
    })
  }

  return extendedHighlighterPromise
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
  return `<pre class="shiki shiki-themes vitesse-light vitesse-dark" style="color:#4a4a4a;background-color:#ffffff;--shiki-light:#4a4a4a;--shiki-light-bg:#ffffff;--shiki-dark:#dbd7ca;--shiki-dark-bg:#1b1b1b"><code>${escapeHtml(source)}</code></pre>`
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
  if (highlightHtmlCache.has(key)) {
    highlightHtmlCache.delete(key)
  } else if (highlightHtmlCache.size >= SHIKI_HIGHLIGHT_CACHE_MAX_ENTRIES) {
    const oldestKey = highlightHtmlCache.keys().next().value
    if (typeof oldestKey === 'string' && oldestKey) {
      highlightHtmlCache.delete(oldestKey)
    }
  }
  highlightHtmlCache.set(key, value)
}

// Shell grammars can split placeholder tokens like `<task>` into `tas` + `k` before `>`.
const BASH_ANGLE_PLACEHOLDER_SPLIT_RE = /(<span style="([^"]+)">)([a-zA-Z0-9_-]+)(<\/span>)(<span style="([^"]+)">)([a-zA-Z0-9_-])(<\/span>)(?=<span style="[^"]+">(?:&#x3E;|>)<\/span>)/g

function harmonizeBashAngleBracketHtml(html: string): string {
  let result = html
  let previous = ''

  while (result !== previous) {
    previous = result
    result = result.replace(
      BASH_ANGLE_PLACEHOLDER_SPLIT_RE,
      (match, openSpan, firstStyle, prefix, closeFirstSpan, trailingOpenSpan, secondStyle, suffix, closeSecondSpan) => {
        if (firstStyle === secondStyle) return match

        const combined = `${prefix}${suffix}`
        if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(combined)) return match

        return `${openSpan}${combined}${closeFirstSpan}`
      }
    )
  }

  return result
}

export async function highlightCodeToHtml(source: string, rawLanguage: string): Promise<HighlightedCode> {
  const displayLanguage = `${rawLanguage || ''}`.trim() || 'plain text'
  const normalized = normalizeCodeLanguage(rawLanguage)
  const language = SHIKI_LANGUAGE_SET.has(normalized) || SHIKI_EXTENDED_LANGUAGE_SET.has(normalized)
    ? normalized
    : 'plaintext'
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
    const highlighter = SHIKI_EXTENDED_LANGUAGE_SET.has(language)
      ? await getExtendedHighlighter()
      : await getBaseHighlighter()
    let html = highlighter.codeToHtml(source, {
      lang: language as BundledLanguage | SpecialLanguage,
      themes: {
        light: 'vitesse-light',
        dark: 'vitesse-dark'
      }
    })

    if (language === 'bash') {
      html = harmonizeBashAngleBracketHtml(html)
    }

    const result = {
      html,
      language,
      displayLanguage
    }
    writeHighlightCache(cacheKey, { html: result.html, language: result.language })
    return result
  } catch (error) {
    warnServerError('shiki:highlight', error, { language, displayLanguage })
    const result = {
      html: renderFallbackHtml(source),
      language: 'plaintext',
      displayLanguage
    }
    writeHighlightCache(cacheKey, { html: result.html, language: result.language })
    return result
  }
}
