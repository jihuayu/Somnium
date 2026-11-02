import SearchLayout from '@/layouts/search'
import { buildPageMetadata } from '@/lib/server/metadata'

export const revalidate = 86400
export const metadata = buildPageMetadata({ title: '搜索', slug: 'search' })

export default async function SearchPage() {
  return <SearchLayout tags={{}} posts={[]} useNotionSearch loadTagsRemotely />
}
