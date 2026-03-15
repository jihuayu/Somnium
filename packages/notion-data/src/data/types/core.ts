export type ResolvableString = string | (() => string)

export interface NotionRichTextItem {
  plain_text?: string | null
}

export interface NotionSelectOption {
  name?: string | null
}

export interface NotionProperty {
  type?: string
  title?: NotionRichTextItem[]
  rich_text?: NotionRichTextItem[]
  url?: string | null
  select?: NotionSelectOption | null
  status?: NotionSelectOption | null
  multi_select?: NotionSelectOption[]
  date?: {
    start?: string | null
  } | null
  relation?: Array<{ id?: string | null }>
}

export type NotionProperties = Record<string, NotionProperty | undefined>

export interface NotionPageParent {
  type?: string
  data_source_id?: string
  database_id?: string
}

export interface NotionPageLike {
  id: string
  url?: string | null
  created_time: string
  last_edited_time: string
  properties: NotionProperties
  parent?: NotionPageParent | null
  cover?: {
    type?: string
    external?: { url?: string | null } | null
    file?: { url?: string | null } | null
  } | null
  icon?: {
    type?: 'emoji' | 'external' | 'file'
    emoji?: string | null
    external?: { url?: string | null } | null
    file?: { url?: string | null } | null
  } | null
}

export type NotionFieldNameInput = string | string[]
