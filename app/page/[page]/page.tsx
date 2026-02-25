import { config } from '@/lib/server/config'
import Container from '@/components/Container'
import BlogPost from '@/components/BlogPost'
import Pagination from '@/components/Pagination'
import { getAllPosts } from '@/lib/notion'

export const revalidate = 1

export async function generateStaticParams() {
  const posts = await getAllPosts({ includePages: false })
  const totalPosts = posts.length
  const totalPages = Math.ceil(totalPosts / config.postsPerPage)
  const paginatedPathsCount = Math.max(0, totalPages - 1)
  return Array.from({ length: paginatedPathsCount }, (_, i) => ({
    page: '' + (i + 2)
  }))
}

interface PageProps {
  params: Promise<{ page: string }>
}

export default async function PaginationPage({ params }: PageProps) {
  const { page } = await params
  const pageNum = Number(page)
  const posts = await getAllPosts({ includePages: false })
  const postsToShow = posts.slice(
    config.postsPerPage * (pageNum - 1),
    config.postsPerPage * pageNum
  )
  const totalPosts = posts.length
  const showNext = pageNum * config.postsPerPage < totalPosts

  return (
    <Container>
      {postsToShow &&
        postsToShow.map(post => <BlogPost key={post.id} post={post} />)}
      <Pagination page={pageNum} showNext={showNext} />
    </Container>
  )
}
