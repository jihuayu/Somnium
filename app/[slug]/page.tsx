import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cache } from 'react'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import loadLocale from '@/assets/i18n'
import ContainerServer from '@/components/ContainerServer'
import { buildPageMetadata } from '@/lib/server/metadata'
import { getLinkPreviewMap } from '@/lib/server/linkPreview'
import { getLinkPreviewTargets } from '@/lib/notion/linkPreviewTargets'
import { config } from '@/lib/server/config'
import SlugPostClient from './slug-client'

export const revalidate = 1
const getPosts = cache(async () => getAllPosts({ includePages: true }))

export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map(row => ({
    slug: row.slug
  }))
}

interface SlugPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  const { slug } = await params
  const posts = await getPosts()
  const post = posts.find(t => t.slug === slug)

  if (!post) return buildPageMetadata()

  return buildPageMetadata({
    title: post.title,
    description: post.summary,
    slug: post.slug,
    type: 'article',
    date: post.date
  })
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params
  const posts = await getPosts()
  const post = posts.find(t => t.slug === slug)

  if (!post) notFound()

  const document = await getPostBlocks(post.id)
  if (!document) notFound()
  const linkPreviewMap = await getLinkPreviewMap(getLinkPreviewTargets(document))
  const locale = await loadLocale('basic', config.lang)

  const fullWidth = post.fullWidth ?? false

  return (
    <ContainerServer
      layout="blog"
      title={post.title}
      fullWidth={fullWidth}
    >
      <SlugPostClient
        post={post}
        document={document}
        fullWidth={fullWidth}
        homePath={config.path || '/'}
        backLabel={locale.POST.BACK}
        topLabel={locale.POST.TOP}
        linkPreviewMap={linkPreviewMap}
      />
    </ContainerServer>
  )
}
