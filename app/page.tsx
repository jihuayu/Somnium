import { clientConfig } from '@/lib/server/config'
import ContainerServer from '@/components/ContainerServer'
import BlogPostServer from '@/components/BlogPostServer'
import Pagination from '@/components/Pagination'
import { getAllPosts } from '@/lib/notion'

export const revalidate = 1

export default async function HomePage() {
  const posts = await getAllPosts({ includePages: false })
  const postsToShow = posts.slice(0, clientConfig.postsPerPage)
  const totalPosts = posts.length
  const showNext = totalPosts > clientConfig.postsPerPage

  return (
    <ContainerServer>
      {postsToShow.map(post => (
        <BlogPostServer key={post.id} post={post} />
      ))}
      {showNext && <Pagination page={1} showNext={showNext} />}
    </ContainerServer>
  )
}
