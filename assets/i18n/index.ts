import type { Locale } from '@/lib/locale'

const localeData: Record<string, Record<string, () => Promise<Locale>>> = {
  basic: {
    'en-US': () => import('./basic/en-US.json').then(m => m.default as unknown as Locale),
    'es-ES': () => import('./basic/es-ES.json').then(m => m.default as unknown as Locale),
    'ja-JP': () => import('./basic/ja-JP.json').then(m => m.default as unknown as Locale),
    'zh-CN': () => import('./basic/zh-CN.json').then(m => m.default as unknown as Locale),
    'zh-HK': () => import('./basic/zh-HK.json').then(m => m.default as unknown as Locale),
    'zh-TW': () => import('./basic/zh-TW.json').then(m => m.default as unknown as Locale),
  }
}

export default async function loadLocale(section: string, lang: string): Promise<Locale> {
  const sectionData = localeData[section]
  if (!sectionData) throw new Error(`Unknown locale section: ${section}`)
  const loader = sectionData[lang]
  if (!loader) throw new Error(`Unknown locale lang: ${lang}`)
  return loader()
}
