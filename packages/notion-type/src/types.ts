export type NotionBlockType =
  | 'paragraph'
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'quote'
  | 'callout'
  | 'equation'
  | 'code'
  | 'image'
  | 'column'
  | 'column_list'
  | 'toggle'
  | 'template'
  | 'tab'
  | 'table_of_contents'
  | 'link_to_page'
  | 'child_page'
  | 'child_database'
  | 'synced_block'
  | 'breadcrumb'
  | 'embed'
  | 'bookmark'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'file'
  | 'table'
  | 'table_row'
  | 'link_preview'
  | 'divider'
  | 'bulleted_list_item'
  | 'numbered_list_item'
  | 'to_do'
  | 'unsupported'

export interface NotionTextAnnotations {
  bold?: boolean
  italic?: boolean
  strikethrough?: boolean
  underline?: boolean
  code?: boolean
  color?: string
  text_color?: string
  foreground_color?: string
  font_color?: string
  background_color?: string
  bg_color?: string
  highlight_color?: string
  background?: string
}

export interface NotionRichTextBase {
  plain_text?: string
  href?: string | null
  annotations?: NotionTextAnnotations
}

export interface NotionRichTextText extends NotionRichTextBase {
  type: 'text'
  text?: {
    content?: string
    link?: {
      url?: string
    } | null
  }
}

export interface NotionRichTextEquation extends NotionRichTextBase {
  type: 'equation'
  equation?: {
    expression?: string
  }
}

export interface NotionRichTextDateMention extends NotionRichTextBase {
  type: 'mention'
  mention?: {
    type: 'date'
    date?: {
      start?: string
      end?: string | null
      time_zone?: string | null
    }
  }
}

export interface NotionRichTextLinkPreviewMention extends NotionRichTextBase {
  type: 'mention'
  mention?: {
    type: 'link_preview'
    link_preview?: {
      url?: string
    }
  }
}

export interface NotionRichTextLinkMention extends NotionRichTextBase {
  type: 'mention'
  mention?: {
    type: 'link_mention'
    link_mention?: {
      href?: string
      title?: string
      description?: string
      icon_url?: string
      thumbnail_url?: string
      link_provider?: string
    }
  }
}

export type NotionRichText =
  | NotionRichTextText
  | NotionRichTextEquation
  | NotionRichTextDateMention
  | NotionRichTextLinkPreviewMention
  | NotionRichTextLinkMention
  | (NotionRichTextBase & { type: string, [key: string]: unknown })

export interface NotionFileReferencePayload {
  url?: string
}

export interface NotionFileReference {
  type?: 'external' | 'file'
  external?: NotionFileReferencePayload
  file?: NotionFileReferencePayload
}

export interface NotionCaptionedPayload extends NotionFileReference {
  caption?: NotionRichText[]
  name?: string
}

export interface NotionBlockIcon {
  type?: 'emoji' | 'external' | 'file'
  emoji?: string
  external?: { url?: string }
  file?: { url?: string }
}

export interface NotionBlockBase<TType extends NotionBlockType = NotionBlockType> {
  id: string
  type: TType
  has_children?: boolean
}

export interface NotionParagraphBlock extends NotionBlockBase<'paragraph'> {
  type: 'paragraph'
  paragraph: {
    rich_text: NotionRichText[]
    icon?: NotionBlockIcon | null
  }
}

export interface NotionHeading1Block extends NotionBlockBase<'heading_1'> {
  type: 'heading_1'
  heading_1: { rich_text: NotionRichText[] }
}

export interface NotionHeading2Block extends NotionBlockBase<'heading_2'> {
  type: 'heading_2'
  heading_2: { rich_text: NotionRichText[] }
}

export interface NotionHeading3Block extends NotionBlockBase<'heading_3'> {
  type: 'heading_3'
  heading_3: { rich_text: NotionRichText[] }
}

export interface NotionQuoteBlock extends NotionBlockBase<'quote'> {
  type: 'quote'
  quote: { rich_text: NotionRichText[] }
}

export interface NotionCalloutBlock extends NotionBlockBase<'callout'> {
  type: 'callout'
  callout: {
    rich_text: NotionRichText[]
    icon?: NotionBlockIcon | null
  }
}

export interface NotionEquationBlock extends NotionBlockBase<'equation'> {
  type: 'equation'
  equation: { expression?: string }
}

export interface NotionCodeBlock extends NotionBlockBase<'code'> {
  type: 'code'
  code: {
    language: string
    rich_text: NotionRichText[]
    caption?: NotionRichText[]
  }
}

export interface NotionImageBlock extends NotionBlockBase<'image'> {
  type: 'image'
  image: NotionCaptionedPayload
}

export interface NotionColumnBlock extends NotionBlockBase<'column'> {
  type: 'column'
  column: { width_ratio?: number }
}

export interface NotionColumnListBlock extends NotionBlockBase<'column_list'> {
  type: 'column_list'
}

export interface NotionToggleBlock extends NotionBlockBase<'toggle'> {
  type: 'toggle'
  toggle: { rich_text: NotionRichText[] }
}

export interface NotionTemplateBlock extends NotionBlockBase<'template'> {
  type: 'template'
  template: { rich_text: NotionRichText[] }
}

export interface NotionTabBlock extends NotionBlockBase<'tab'> {
  type: 'tab'
  tab: Record<string, unknown>
}

export interface NotionTableOfContentsBlock extends NotionBlockBase<'table_of_contents'> {
  type: 'table_of_contents'
}

export interface NotionLinkToPageBlock extends NotionBlockBase<'link_to_page'> {
  type: 'link_to_page'
  link_to_page: {
    type?: 'page_id' | 'database_id' | 'block_id' | 'comment_id'
    page_id?: string
    database_id?: string
    block_id?: string
    comment_id?: string
  }
}

export interface NotionChildPageBlock extends NotionBlockBase<'child_page'> {
  type: 'child_page'
  child_page: { title: string }
}

export interface NotionChildDatabaseBlock extends NotionBlockBase<'child_database'> {
  type: 'child_database'
  child_database: { title: string }
}

export interface NotionSyncedBlock extends NotionBlockBase<'synced_block'> {
  type: 'synced_block'
  synced_block: {
    synced_from?: {
      block_id?: string
    } | null
  }
}

export interface NotionBreadcrumbBlock extends NotionBlockBase<'breadcrumb'> {
  type: 'breadcrumb'
}

export interface NotionEmbedBlock extends NotionBlockBase<'embed'> {
  type: 'embed'
  embed: { url: string, caption?: NotionRichText[] }
}

export interface NotionBookmarkBlock extends NotionBlockBase<'bookmark'> {
  type: 'bookmark'
  bookmark: { url: string, caption?: NotionRichText[] }
}

export interface NotionVideoBlock extends NotionBlockBase<'video'> {
  type: 'video'
  video: NotionCaptionedPayload
}

export interface NotionAudioBlock extends NotionBlockBase<'audio'> {
  type: 'audio'
  audio: NotionCaptionedPayload
}

export interface NotionPdfBlock extends NotionBlockBase<'pdf'> {
  type: 'pdf'
  pdf: NotionCaptionedPayload
}

export interface NotionFileBlock extends NotionBlockBase<'file'> {
  type: 'file'
  file: NotionCaptionedPayload
}

export interface NotionTableBlock extends NotionBlockBase<'table'> {
  type: 'table'
  table: {
    table_width: number
    has_column_header: boolean
    has_row_header: boolean
  }
}

export interface NotionTableRowBlock extends NotionBlockBase<'table_row'> {
  type: 'table_row'
  table_row: { cells: NotionRichText[][] }
}

export interface NotionLinkPreviewBlock extends NotionBlockBase<'link_preview'> {
  type: 'link_preview'
  link_preview: { url: string }
}

export interface NotionDividerBlock extends NotionBlockBase<'divider'> {
  type: 'divider'
}

export interface NotionBulletedListItemBlock extends NotionBlockBase<'bulleted_list_item'> {
  type: 'bulleted_list_item'
  bulleted_list_item: { rich_text: NotionRichText[] }
}

export interface NotionNumberedListItemBlock extends NotionBlockBase<'numbered_list_item'> {
  type: 'numbered_list_item'
  numbered_list_item: { rich_text: NotionRichText[] }
}

export interface NotionToDoBlock extends NotionBlockBase<'to_do'> {
  type: 'to_do'
  to_do: {
    rich_text: NotionRichText[]
    checked?: boolean
  }
}

export interface NotionUnsupportedBlock extends NotionBlockBase<'unsupported'> {
  type: 'unsupported'
  unsupported?: {
    originalType?: string
  }
}

export type NotionBlock =
  | NotionParagraphBlock
  | NotionHeading1Block
  | NotionHeading2Block
  | NotionHeading3Block
  | NotionQuoteBlock
  | NotionCalloutBlock
  | NotionEquationBlock
  | NotionCodeBlock
  | NotionImageBlock
  | NotionColumnBlock
  | NotionColumnListBlock
  | NotionToggleBlock
  | NotionTemplateBlock
  | NotionTabBlock
  | NotionTableOfContentsBlock
  | NotionLinkToPageBlock
  | NotionChildPageBlock
  | NotionChildDatabaseBlock
  | NotionSyncedBlock
  | NotionBreadcrumbBlock
  | NotionEmbedBlock
  | NotionBookmarkBlock
  | NotionVideoBlock
  | NotionAudioBlock
  | NotionPdfBlock
  | NotionFileBlock
  | NotionTableBlock
  | NotionTableRowBlock
  | NotionLinkPreviewBlock
  | NotionDividerBlock
  | NotionBulletedListItemBlock
  | NotionNumberedListItemBlock
  | NotionToDoBlock
  | NotionUnsupportedBlock

export interface TocItem {
  id: string
  text: string
  indentLevel: number
}

export interface NotionDocument {
  pageId: string
  rootIds: string[]
  blocksById: Record<string, NotionBlock>
  childrenById: Record<string, string[]>
  toc?: TocItem[]
}

export interface LinkPreviewData {
  url: string
  hostname: string
  title: string
  description: string
  image: string
  icon: string
}

export type LinkPreviewMap = Record<string, LinkPreviewData>
export type PageHrefMap = Record<string, string>
export type PagePreviewMap = Record<string, LinkPreviewData>

export interface PageHrefEntry {
  id: string
  slug: string
}

export interface NotionDirectoryRichTextItem {
  plain_text?: string | null
}

export interface NotionDirectorySelectOption {
  name?: string | null
}

export interface NotionDirectoryRelationItem {
  id?: string | null
}

export interface NotionDirectoryFormulaValue {
  type?: 'string' | 'number' | 'boolean' | 'date'
  string?: string | null
  number?: number | null
  boolean?: boolean | null
}

export interface NotionDirectoryProperty {
  type?: string
  title?: NotionDirectoryRichTextItem[]
  rich_text?: NotionDirectoryRichTextItem[]
  url?: string | null
  select?: NotionDirectorySelectOption | null
  status?: NotionDirectorySelectOption | null
  multi_select?: NotionDirectorySelectOption[]
  relation?: NotionDirectoryRelationItem[]
  formula?: NotionDirectoryFormulaValue | null
  files?: Array<(NotionFileReference & { name?: string | null })>
}

export interface NotionDirectoryPageIcon {
  type?: 'emoji' | 'external' | 'file'
  emoji?: string | null
  external?: { url?: string | null } | null
  file?: { url?: string | null } | null
}

export interface NotionDirectoryPageLike {
  id: string
  url?: string | null
  icon?: NotionDirectoryPageIcon | null
  properties?: Record<string, NotionDirectoryProperty | undefined>
}

export interface NotionDirectoryTreeFieldNames {
  title?: string | string[]
  desc?: string | string[]
  tag?: string | string[]
  url?: string | string[]
  icon?: string | string[]
  parent?: string | string[]
}

export interface NotionDirectoryTreeNode {
  id: string
  title: string
  desc: string
  tag: string[]
  url: string
  icon: string
  children: NotionDirectoryTreeNode[]
}

export interface NotionDirectoryTreeEntry extends Omit<NotionDirectoryTreeNode, 'children'> {
  parentId: string
}

export interface NotionDirectoryTreeSnapshot {
  roots: NotionDirectoryTreeNode[]
  nodesById: Record<string, NotionDirectoryTreeNode>
  entriesById: Record<string, NotionDirectoryTreeEntry>
}

export interface NotionDirectoryTreeBuildOptions {
  fieldNames?: NotionDirectoryTreeFieldNames
  resolveUrl?: (page: NotionDirectoryPageLike, entry: Omit<NotionDirectoryTreeEntry, 'url' | 'parentId'> & { parentId: string }) => string
  resolveIcon?: (page: NotionDirectoryPageLike, entry: Omit<NotionDirectoryTreeEntry, 'icon' | 'parentId'> & { parentId: string }) => string
  resolveParentId?: (page: NotionDirectoryPageLike, entry: Omit<NotionDirectoryTreeEntry, 'parentId'>) => string
  sortChildren?: (left: NotionDirectoryTreeNode, right: NotionDirectoryTreeNode) => number
}

export interface NotionDirectoryTreeWebhookPayload {
  verification_token?: string
  type?: string
  entity?: {
    id?: string
    type?: string
  }
  data?: {
    [key: string]: unknown
  }
}

export interface NotionDirectoryTreeFullRefreshInput {
  mode: 'full'
  pages: NotionDirectoryPageLike[]
}

export interface NotionDirectoryTreeWebhookRefreshInput {
  mode: 'webhook'
  payload: NotionDirectoryTreeWebhookPayload
  page?: NotionDirectoryPageLike | null
  pages?: NotionDirectoryPageLike[] | null
}

export type NotionDirectoryTreeRefreshInput =
  | NotionDirectoryTreeFullRefreshInput
  | NotionDirectoryTreeWebhookRefreshInput

export interface NotionDirectoryTreeRefreshResult {
  snapshot: NotionDirectoryTreeSnapshot
  changed: boolean
  requiresFullRefresh: boolean
  reason: string
}