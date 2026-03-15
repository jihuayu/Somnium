import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { getAllPosts, getPostBlocks } from '@/lib/notion'
import loadLocale from '@/assets/i18n'
import ContainerServer from '@/components/ContainerServer'
import { buildNotionOgImageUrl, buildPageMetadata } from '@/lib/server/metadata'
import { buildPageLinkMap } from '@/lib/notion/pageLinkMap'
import { buildPostPagePreviewMap } from '@/lib/notion/postAdapter'
import { config } from '@/lib/server/config'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'
import SlugPostClient from './slug-client'

export const revalidate = 86400
const PAGE_LINK_MAP_CACHE_REVALIDATE_SECONDS = ONE_DAY_SECONDS
const getCachedPageMaps = unstable_cache(
  async () => {
    const allPosts = await getAllPosts({ includePages: true })
    const pageLinkMap = buildPageLinkMap(allPosts, config.path || '')
    const pagePreviewMap = buildPostPagePreviewMap(allPosts, pageLinkMap, {
      siteUrl: config.link || '',
      buildImageUrl: buildNotionOgImageUrl
    })
    return { pageLinkMap, pagePreviewMap }
  },
  ['page-maps-v1'],
  { revalidate: PAGE_LINK_MAP_CACHE_REVALIDATE_SECONDS, tags: ['page-link-map'] }
)
const getSlugPageState = cache(async () => {
  const posts = await getAllPosts({ includePages: true })
  const postsBySlug = new Map(posts.map(post => [post.slug, post] as const))
  const cachedPageMaps = await getCachedPageMaps()

  const pageLinkMap = Object.keys(cachedPageMaps.pageLinkMap).length
    ? cachedPageMaps.pageLinkMap
    : buildPageLinkMap(posts, config.path || '')
  const pagePreviewMap = Object.keys(cachedPageMaps.pagePreviewMap).length
    ? cachedPageMaps.pagePreviewMap
    : buildPostPagePreviewMap(posts, pageLinkMap, {
      siteUrl: config.link || '',
      buildImageUrl: buildNotionOgImageUrl
    })

  return {
    posts,
    postsBySlug,
    pageLinkMap,
    pagePreviewMap
  }
})

export async function generateStaticParams() {
  const { posts } = await getSlugPageState()
  return posts.map(row => ({
    slug: row.slug
  }))
}

interface SlugPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: SlugPageProps): Promise<Metadata> {
  const { slug } = await params
  const { postsBySlug } = await getSlugPageState()
  const post = postsBySlug.get(slug)

  if (!post) return buildPageMetadata()

  return buildPageMetadata({
    title: post.title,
    description: post.summary,
    slug: post.slug,
    type: 'article',
    date: post.date,
    ogImageUrl: buildNotionOgImageUrl(post.id)
  })
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params
  const { postsBySlug, pageLinkMap, pagePreviewMap } = await getSlugPageState()
  const post = postsBySlug.get(slug)

  if (!post) notFound()

  const document = await getPostBlocks(post.id)
  if (!document) notFound()
  const [locale] = await Promise.all([
    loadLocale('basic', config.lang)
  ])

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
        pageLinkMap={pageLinkMap}
        pagePreviewMap={pagePreviewMap}
      />
    </ContainerServer>
  )
}
