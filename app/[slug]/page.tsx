import { clientConfig } from '@/lib/server/config'
import { notFound } from 'next/navigation'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import Container from '@/components/Container'
import SlugPostClient from './slug-client'

export const revalidate = 1

export async function generateStaticParams() {
  const posts = await getAllPosts({ includePages: true })
  return posts.map(row => ({
    slug: row.slug
  }))
}

interface SlugPageProps {
  params: Promise<{ slug: string }>
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params
  const posts = await getAllPosts({ includePages: true })
  const post = posts.find(t => t.slug === slug)

  if (!post) notFound()

  const document = await getPostBlocks(post.id)

  const fullWidth = post.fullWidth ?? false

  return (
    <Container
      layout="blog"
      title={post.title}
      description={post.summary}
      slug={post.slug}
      type="article"
      fullWidth={fullWidth}
    >
      <SlugPostClient post={post} document={document!} fullWidth={fullWidth} />
    </Container>
  )
}
