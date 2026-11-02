import Link from 'next/link'
import loadLocale from '@/assets/i18n'
import { config } from '@/lib/server/config'

interface PaginationProps {
  page: number
  showNext: boolean
}

export default async function Pagination({ page, showNext }: PaginationProps) {
  const locale = await loadLocale('basic', config.lang)
  const currentPage = +page
  let additionalClassName = 'justify-between'
  if (currentPage === 1 && showNext) additionalClassName = 'justify-end'
  if (currentPage !== 1 && !showNext) additionalClassName = 'justify-start'

  return (
    <nav aria-label="文章分页" className={`pagination flex text-sm ${additionalClassName}`}>
      {currentPage !== 1 && (
        <Link
          href={
            currentPage - 1 === 1
              ? `${config.path || '/'}`
              : `/page/${currentPage - 1}`
          }
          prefetch={false}
          rel="prev"
          className="flex items-center gap-1.5 transition-colors duration-150 ease-out"
        >
          <span aria-hidden="true">←</span>
          {locale.PAGINATION.PREV}
        </Link>
      )}
      {showNext && (
        <Link
          href={`/page/${currentPage + 1}`}
          prefetch={false}
          rel="next"
          className="flex items-center gap-1.5 transition-colors duration-150 ease-out"
        >
          {locale.PAGINATION.NEXT}
          <span aria-hidden="true">→</span>
        </Link>
      )}
    </nav>
  )
}
