import SearchLayout from '@/layouts/search'
import { ONE_DAY_SECONDS } from '@/lib/server/cache'

export const revalidate = ONE_DAY_SECONDS

export default async function SearchPage() {
  return <SearchLayout tags={{}} posts={[]} useNotionSearch loadTagsRemotely />
}
