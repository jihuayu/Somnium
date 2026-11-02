import Link from 'next/link'
import { ARTICLE_CONTENT_MAX_WIDTH_CLASS, ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS } from '@/consts'
import { config } from '@/lib/server/config'

interface FooterServerProps {
  fullWidth?: boolean
}

export default function FooterServer({ fullWidth }: FooterServerProps) {
  const currentYear = new Date().getFullYear()
  const since = +config.since
  const contentWidthClass = fullWidth ? ARTICLE_WIDE_CONTENT_MAX_WIDTH_CLASS : ARTICLE_CONTENT_MAX_WIDTH_CLASS

  return (
    <div
      className={`mt-12 flex-shrink-0 m-auto w-full px-5 site-footer ${contentWidthClass}`}
    >
      <hr className="border-stone-200 dark:border-stone-800" />
      <div className="my-4 text-sm leading-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p>
            © {config.author} {since === currentYear || !since ? currentYear : `${since} - ${currentYear}`}
          </p>
          <nav aria-label="页脚导航" className="footer-links">
            {config.showArchive && <Link href="/archive">全部文章</Link>}
            <Link href="/feed">订阅</Link>
          </nav>
        </div>
      </div>
    </div>
  )
}
