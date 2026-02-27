import SearchLayout from '@/layouts/search'

export const revalidate = 60

export default async function SearchPage() {
  return <SearchLayout tags={{}} posts={[]} useNotionSearch loadTagsRemotely />
}
