import ContainerServer from '@/components/ContainerServer'
import SearchClient from '@/components/SearchClient'
import { config } from '@/lib/server/config'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface SearchLayoutProps {
  tags: Record<string, number>
  posts: PostData[]
  currentTag?: string
  useNotionSearch?: boolean
  loadTagsRemotely?: boolean
}

export default function SearchLayout({
  tags,
  posts,
  currentTag,
  useNotionSearch = false,
  loadTagsRemotely = false
}: SearchLayoutProps) {
  return (
    <ContainerServer>
      <SearchClient
        tags={tags}
        posts={posts}
        currentTag={currentTag}
        useNotionSearch={useNotionSearch}
        loadTagsRemotely={loadTagsRemotely}
        blogPath={config.path || ''}
        lang={config.lang}
        timezone={config.timezone}
      />
    </ContainerServer>
  )
}
