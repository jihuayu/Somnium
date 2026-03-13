import { config } from '@/lib/server/config'

interface PaginationProps {
  page: number
  showNext: boolean
  prevLabel: string
  nextLabel: string
}

export default function Pagination({ page, showNext, prevLabel, nextLabel }: PaginationProps) {
  const currentPage = +page
  let additionalClassName = 'justify-between'
  if (currentPage === 1 && showNext) additionalClassName = 'justify-end'
  if (currentPage !== 1 && !showNext) additionalClassName = 'justify-start'

  return (
    <div className={`flex font-medium text-black dark:text-gray-100 ${additionalClassName}`}>
      {currentPage !== 1 && (
        <a
          href={
            currentPage - 1 === 1
              ? `${config.path || '/'}`
              : `/page/${currentPage - 1}`
          }
          rel="prev"
          className="block cursor-pointer"
        >
          ← {prevLabel}
        </a>
      )}
      {showNext && (
        <a href={`/page/${currentPage + 1}`} rel="next" className="block cursor-pointer">
          {nextLabel} →
        </a>
      )}
    </div>
  )
}
