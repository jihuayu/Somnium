import ContainerServer from '@/components/ContainerServer'
import SearchClient from '@/components/SearchClient'
import BlogPostServer from '@/components/BlogPostServer'
import Tags from '@/components/Tags'
import { config } from '@/lib/server/config'
import loadLocale from '@/assets/i18n'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface SearchLayoutProps {
  tags: Record<string, number>
  posts: PostData[]
  currentTag?: string
  useNotionSearch?: boolean
  loadTagsRemotely?: boolean
}

export default async function SearchLayout({
  tags,
  posts,
  currentTag,
  useNotionSearch = false,
  loadTagsRemotely = false
}: SearchLayoutProps) {
  const locale = await loadLocale('basic', config.lang)
  const staticTags = loadTagsRemotely
    ? null
    : <Tags tags={tags} currentTag={currentTag} />

  return (
    <ContainerServer>
      <SearchClient
        tags={loadTagsRemotely ? tags : {}}
        posts={useNotionSearch ? [] : posts}
        currentTag={currentTag}
        useNotionSearch={useNotionSearch}
        loadTagsRemotely={loadTagsRemotely}
        blogPath={config.path || ''}
        lang={config.lang}
        timezone={config.timezone}
        tagsSlot={staticTags}
        initialResultsCount={posts.length}
        copy={locale.SEARCH}
      >
        {posts.slice(0, 20).map(post => (
          <BlogPostServer key={post.id} post={post} />
        ))}
      </SearchClient>
    </ContainerServer>
  )
}
