import type { NavLocale } from '@/components/ContainerServer'
import SearchLayout from '@/layouts/search'
import type { PostData } from '@/lib/notion/filterPublishedPosts'

interface SearchPageViewProps {
  tags: Record<string, number>
  posts: PostData[]
  currentTag?: string
  useNotionSearch?: boolean
  loadTagsRemotely?: boolean
  navLocale: NavLocale
}

export default function SearchPageView(props: SearchPageViewProps) {
  return <SearchLayout {...props} />
}