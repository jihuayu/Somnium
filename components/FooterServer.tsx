import Link from 'next/link'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS, ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { config } from '@/lib/server/config'
import loadLocale from '@/assets/i18n'

interface FooterServerProps {
  fullWidth?: boolean
}

export default async function FooterServer({ fullWidth }: FooterServerProps) {
  const currentYear = new Date().getFullYear()
  const since = +config.since
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS
  const locale = await loadLocale('basic', config.lang)

  return (
    <div
      className={`mt-12 flex-shrink-0 m-auto w-full px-4 text-stone-400 dark:text-stone-500 ${contentWidthClass}`}
    >
      <hr className="border-stone-200 dark:border-stone-800" />
      <div className="my-4 text-sm leading-6">
        <div className="flex align-baseline justify-between flex-wrap gap-x-6 gap-y-2">
          <p>
            © {config.author} {since === currentYear || !since ? currentYear : `${since} - ${currentYear}`}
          </p>
          <nav className="flex flex-wrap items-center gap-x-3">
            <Link
              href="/feed"
              prefetch={false}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-150 ease-out"
            >
              {locale.NAV.RSS}
            </Link>
            <span aria-hidden="true">·</span>
            <Link
              href="/search"
              prefetch={false}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-150 ease-out"
            >
              {locale.NAV.SEARCH}
            </Link>
            {config.showAbout && (
              <>
                <span aria-hidden="true">·</span>
                <Link
                  href="/about"
                  prefetch={false}
                  className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors duration-150 ease-out"
                >
                  {locale.NAV.ABOUT}
                </Link>
              </>
            )}
          </nav>
        </div>
      </div>
    </div>
  )
}
