import { createHighlighter, type BundledLanguage, type Highlighter, type SpecialLanguage } from 'shiki'

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

let highlighterPromise: Promise<Highlighter> | null = null

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

export async function highlightCodeToHtml(source: string, rawLanguage: string): Promise<HighlightedCode> {
  const displayLanguage = `${rawLanguage || ''}`.trim() || 'plain text'
  const normalized = normalizeCodeLanguage(rawLanguage)
  const language = SHIKI_LANGUAGE_SET.has(normalized) ? normalized : 'plaintext'

  if (!source) {
    return {
      html: renderFallbackHtml(''),
      language,
      displayLanguage
    }
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

    return {
      html,
      language,
      displayLanguage
    }
  } catch {
    return {
      html: renderFallbackHtml(source),
      language: 'plaintext',
      displayLanguage
    }
  }
}
