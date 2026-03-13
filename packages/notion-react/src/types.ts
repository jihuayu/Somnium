import type { CSSProperties, ComponentType, ReactNode } from 'react'

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

export interface NotionBlockBase {
  id: string
  type: NotionBlockType | string
  has_children?: boolean
  [key: string]: unknown
}

export interface NotionParagraphBlock extends NotionBlockBase {
  type: 'paragraph'
  paragraph?: { rich_text?: NotionRichText[] }
}

export interface NotionHeading1Block extends NotionBlockBase {
  type: 'heading_1'
  heading_1?: { rich_text?: NotionRichText[] }
}

export interface NotionHeading2Block extends NotionBlockBase {
  type: 'heading_2'
  heading_2?: { rich_text?: NotionRichText[] }
}

export interface NotionHeading3Block extends NotionBlockBase {
  type: 'heading_3'
  heading_3?: { rich_text?: NotionRichText[] }
}

export interface NotionQuoteBlock extends NotionBlockBase {
  type: 'quote'
  quote?: { rich_text?: NotionRichText[] }
}

export interface NotionCalloutBlock extends NotionBlockBase {
  type: 'callout'
  callout?: {
    rich_text?: NotionRichText[]
    icon?: {
      type?: 'emoji' | 'external' | 'file'
      emoji?: string
      external?: { url?: string }
      file?: { url?: string }
    } | null
  }
}

export interface NotionEquationBlock extends NotionBlockBase {
  type: 'equation'
  equation?: { expression?: string }
}

export interface NotionCodeBlock extends NotionBlockBase {
  type: 'code'
  code?: {
    language?: string
    rich_text?: NotionRichText[]
    caption?: NotionRichText[]
  }
}

export interface NotionImageBlock extends NotionBlockBase {
  type: 'image'
  image?: NotionCaptionedPayload
}

export interface NotionColumnBlock extends NotionBlockBase {
  type: 'column'
  column?: { width_ratio?: number }
}

export interface NotionColumnListBlock extends NotionBlockBase {
  type: 'column_list'
}

export interface NotionToggleBlock extends NotionBlockBase {
  type: 'toggle'
  toggle?: { rich_text?: NotionRichText[] }
}

export interface NotionTemplateBlock extends NotionBlockBase {
  type: 'template'
  template?: { rich_text?: NotionRichText[] }
}

export interface NotionTableOfContentsBlock extends NotionBlockBase {
  type: 'table_of_contents'
}

export interface NotionLinkToPageBlock extends NotionBlockBase {
  type: 'link_to_page'
  link_to_page?: {
    type?: 'page_id' | 'database_id' | 'block_id' | 'comment_id'
    page_id?: string
    database_id?: string
    block_id?: string
    comment_id?: string
  }
}

export interface NotionChildPageBlock extends NotionBlockBase {
  type: 'child_page'
  child_page?: { title?: string }
}

export interface NotionChildDatabaseBlock extends NotionBlockBase {
  type: 'child_database'
  child_database?: { title?: string }
}

export interface NotionSyncedBlock extends NotionBlockBase {
  type: 'synced_block'
  synced_block?: {
    synced_from?: {
      block_id?: string
    } | null
  }
}

export interface NotionBreadcrumbBlock extends NotionBlockBase {
  type: 'breadcrumb'
}

export interface NotionEmbedBlock extends NotionBlockBase {
  type: 'embed'
  embed?: { url?: string, caption?: NotionRichText[] }
}

export interface NotionBookmarkBlock extends NotionBlockBase {
  type: 'bookmark'
  bookmark?: { url?: string, caption?: NotionRichText[] }
}

export interface NotionVideoBlock extends NotionBlockBase {
  type: 'video'
  video?: NotionCaptionedPayload
}

export interface NotionAudioBlock extends NotionBlockBase {
  type: 'audio'
  audio?: NotionCaptionedPayload
}

export interface NotionPdfBlock extends NotionBlockBase {
  type: 'pdf'
  pdf?: NotionCaptionedPayload
}

export interface NotionFileBlock extends NotionBlockBase {
  type: 'file'
  file?: NotionCaptionedPayload
}

export interface NotionTableBlock extends NotionBlockBase {
  type: 'table'
  table?: {
    table_width?: number
    has_column_header?: boolean
    has_row_header?: boolean
  }
}

export interface NotionTableRowBlock extends NotionBlockBase {
  type: 'table_row'
  table_row?: { cells?: NotionRichText[][] }
}

export interface NotionLinkPreviewBlock extends NotionBlockBase {
  type: 'link_preview'
  link_preview?: { url?: string }
}

export interface NotionDividerBlock extends NotionBlockBase {
  type: 'divider'
}

export interface NotionBulletedListItemBlock extends NotionBlockBase {
  type: 'bulleted_list_item'
  bulleted_list_item?: { rich_text?: NotionRichText[] }
}

export interface NotionNumberedListItemBlock extends NotionBlockBase {
  type: 'numbered_list_item'
  numbered_list_item?: { rich_text?: NotionRichText[] }
}

export interface NotionToDoBlock extends NotionBlockBase {
  type: 'to_do'
  to_do?: {
    rich_text?: NotionRichText[]
    checked?: boolean
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
  | NotionBlockBase

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
export interface PageHrefEntry {
  id: string
  slug: string
}

export interface HighlightedCode {
  html: string
  language: string
  displayLanguage: string
}

export type HighlightedCodeByBlockId = Record<string, HighlightedCode>

export interface NotionRenderModel {
  document: NotionDocument
  toc: TocItem[]
  highlightedCodeByBlockId: HighlightedCodeByBlockId
  linkPreviewMap: LinkPreviewMap
  pageHrefMap: PageHrefMap
}

export type HighlightCodeResolver = (
  source: string,
  language: string
) => Promise<{ html: string, displayLanguage?: string } | null>

export type LinkPreviewResolver = (url: string) => Promise<LinkPreviewData | null>
export type PageHrefResolver = (id: string) => string | null | Promise<string | null>

export interface PrepareNotionRenderModelOptions {
  highlightCode?: HighlightCodeResolver
  resolveLinkPreview?: LinkPreviewResolver
  resolvePageHref?: PageHrefResolver
  initialLinkPreviewMap?: LinkPreviewMap
  initialPageHrefMap?: PageHrefMap
}

export type DateMentionDisplayMode = 'notion' | 'relative' | 'absolute'
export type DateMentionIncludeTimeMode = 'auto' | 'always' | 'never'
export type DateMentionRelativeStyle = 'long' | 'short' | 'narrow'

export interface DateMentionOptions {
  displayMode?: DateMentionDisplayMode
  includeTime?: DateMentionIncludeTimeMode
  absoluteDateFormat?: string
  absoluteDateTimeFormat?: string
  relativeStyle?: DateMentionRelativeStyle
}

export interface NotionRenderOptions {
  locale?: string
  timeZone?: string
  dateMention?: DateMentionOptions
}

export interface ResolvedNotionRenderOptions {
  locale: string
  timeZone: string
  dateMention: {
    displayMode: DateMentionDisplayMode
    includeTime: DateMentionIncludeTimeMode
    absoluteDateFormat: string
    absoluteDateTimeFormat: string
    relativeStyle: DateMentionRelativeStyle
  }
}

export interface DateMentionProps {
  start: string
  end?: string
  timeZone?: string
  locale: string
  displayMode: DateMentionDisplayMode
  includeTime: DateMentionIncludeTimeMode
  absoluteDateFormat: string
  absoluteDateTimeFormat: string
  relativeStyle: DateMentionRelativeStyle
  fallbackText?: string
}

export interface UrlMentionPreviewData {
  href: string
  title: string
  description: string
  icon: string
  image: string
  provider: string
}

export interface UrlMentionProps {
  href: string
  label: string
  iconUrl?: string
  preview: UrlMentionPreviewData | null
  isGithub: boolean
}

export interface MermaidBlockProps {
  code: string
  className?: string
}

export interface LinkPreviewCardProps {
  url: string
  className?: string
  preview?: LinkPreviewData | null
}

export interface UnsupportedBlockProps {
  block: NotionBlock
  className?: string
  message?: string
}

export interface BlockRendererProps {
  block: NotionBlock
  model: NotionRenderModel
  renderOptions: ResolvedNotionRenderOptions
  renderChildren: (blockId: string) => ReactNode
  renderRichText: (richText?: NotionRichText[]) => ReactNode
}

export type BlockRenderer = (props: BlockRendererProps) => ReactNode

export interface NotionRendererComponents {
  blocks?: Partial<Record<NotionBlockType, BlockRenderer>>
  leaves?: Partial<{
    DateMention: ComponentType<DateMentionProps>
    UrlMention: ComponentType<UrlMentionProps>
    MermaidBlock: ComponentType<MermaidBlockProps>
    LinkPreviewCard: ComponentType<LinkPreviewCardProps>
    UnsupportedBlock: ComponentType<UnsupportedBlockProps>
  }>
}

export interface NotionRendererProps {
  model: NotionRenderModel
  components?: NotionRendererComponents
  renderOptions?: NotionRenderOptions
  className?: string
  style?: CSSProperties
}
