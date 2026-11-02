import Link from 'next/link'
import ContainerServer from '@/components/ContainerServer'
import { config } from '@/lib/server/config'
import { getAllPosts } from '@/lib/notion'
import { formatDate } from '@/lib/formatDate'
import { groupPostsByYear } from '@/lib/postNavigation'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'
import { buildPageMetadata } from '@/lib/server/metadata'

export const revalidate = 300
export const metadata = buildPageMetadata({ title: '全部文章', slug: 'archive' })

export default async function ArchivePage() {
  const posts = await getAllPosts({ includePages: false })
  const groups = groupPostsByYear(posts, config.timezone)

  return (
    <ContainerServer>
      <h1 className="page-title">全部文章</h1>
      <p className="archive-count">共 {posts.length} 篇文章。</p>
      {groups.map(group => (
        <section key={group.year} className="archive-year" aria-labelledby={`year-${group.year}`}>
          <h2 id={`year-${group.year}`}>{group.year}</h2>
          <ul>
            {group.posts.map(post => (
              <li key={post.id} className="archive-entry">
                <Link href={buildInternalSlugHref(config.path || '', post.slug)} prefetch={false}>{post.title}</Link>
                <time dateTime={new Date(post.date).toISOString()}>{formatDate(post.date, config.lang, config.timezone)}</time>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </ContainerServer>
  )
}
