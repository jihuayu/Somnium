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
    <div className={`flex font-medium text-black dark:text-gray-100 ${additionalClassName}`}>
      {currentPage !== 1 && (
        <Link
          href={
            currentPage - 1 === 1
              ? `${config.path || '/'}`
              : `/page/${currentPage - 1}`
          }
          prefetch={false}
          rel="prev"
          className="block cursor-pointer"
        >
          ← {locale.PAGINATION.PREV}
        </Link>
      )}
      {showNext && (
        <Link href={`/page/${currentPage + 1}`} prefetch={false} rel="next" className="block cursor-pointer">
          {locale.PAGINATION.NEXT} →
        </Link>
      )}
    </div>
  )
}
