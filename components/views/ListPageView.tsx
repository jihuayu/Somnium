import ContainerServer, { type NavLocale } from '@/components/ContainerServer'
import BlogPostServer from '@/components/BlogPostServer'
import Pagination from '@/components/Pagination'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface PaginationLocale {
  PREV: string
  NEXT: string
}

interface ListPageViewProps {
  posts: PostData[]
  page: number
  showNext: boolean
  navLocale: NavLocale
  paginationLocale: PaginationLocale
}

export default function ListPageView({ posts, page, showNext, navLocale, paginationLocale }: ListPageViewProps) {
  return (
    <ContainerServer navLocale={navLocale}>
      {posts.map(post => (
        <BlogPostServer key={post.id} post={post} />
      ))}
      <Pagination page={page} showNext={showNext} prevLabel={paginationLocale.PREV} nextLabel={paginationLocale.NEXT} />
    </ContainerServer>
  )
}