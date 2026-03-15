import {
  getPropertyByName as getPropertyByNameBase,
  getPageParentDataSourceId as getPageParentDataSourceIdBase,
  normalizeNotionUuid as normalizeNotionUuidBase,
  type NotionPageLike,
  type NotionProperties,
  type NotionProperty
} from '@jihuayu/notion-react/data'
export { mapNotionPageToPost as mapPageToPost } from './postAdapter'

export type { NotionPageLike, NotionProperties, NotionProperty } from '@jihuayu/notion-react/data'

export const normalizeNotionUuid = normalizeNotionUuidBase

export function getPropertyByName<T>(properties: Record<string, T | undefined>, fieldName: string): T | null {
  return getPropertyByNameBase(properties, fieldName)
}

export function getPageParentDataSourceId(page: Pick<NotionPageLike, 'parent'>): string {
  return getPageParentDataSourceIdBase(page)
}
