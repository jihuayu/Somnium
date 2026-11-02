import type { TocItem } from '@jihuayu/notion-type'
import filterPublishedPosts, { type PostData } from '@/lib/notion/filterPublishedPosts'
import { buildInternalSlugHref } from '@/lib/notion/pageLinkMap'

export interface RelatedPostReference {
  slug: string
  label: string
}

export interface RelatedPostLink {
  href: string
  label: string
  title: string
}

export function groupPostsByYear(posts: PostData[], timezone: string) {
  const formatter = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: timezone })
  const groups = new Map<string, PostData[]>()
  for (const post of posts.slice().sort((left, right) => right.date - left.date)) {
    const year = formatter.format(new Date(post.date))
    const yearPosts = groups.get(year) || []
    yearPosts.push(post)
    groups.set(year, yearPosts)
  }
  return Array.from(groups, ([year, yearPosts]) => ({ year, posts: yearPosts }))
}

export function shouldShowTableOfContents(toc: TocItem[], override?: boolean): boolean {
  if (!toc.length) return false
  if (override !== undefined) return override
  const primaryLevel = Math.min(...toc.map(item => item.indentLevel))
  return toc.filter(item => item.indentLevel === primaryLevel).length >= 4
}

export function resolveRelatedPosts(
  currentSlug: string,
  references: RelatedPostReference[],
  posts: PostData[],
  basePath = ''
): RelatedPostLink[] {
  const publishedPosts = filterPublishedPosts({ posts, includePages: false })
  const postsBySlug = new Map(publishedPosts.map(post => [post.slug, post]))
  const seen = new Set([currentSlug])
  const links: RelatedPostLink[] = []
  for (const reference of references) {
    const post = postsBySlug.get(reference.slug)
    if (!post || seen.has(post.slug)) continue
    seen.add(post.slug)
    links.push({
      href: buildInternalSlugHref(basePath, post.slug),
      label: reference.label,
      title: post.title
    })
    if (links.length === 2) break
  }
  return links
}
