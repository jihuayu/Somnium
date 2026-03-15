import type {
  HighlightedCode,
  LinkPreviewMap,
  NotionAudioBlock,
  NotionBookmarkBlock,
  NotionBlock,
  NotionBulletedListItemBlock,
  NotionCalloutBlock,
  NotionCodeBlock,
  NotionEmbedBlock,
  NotionFileBlock,
  NotionHeading1Block,
  NotionHeading2Block,
  NotionHeading3Block,
  NotionImageBlock,
  NotionLinkPreviewBlock,
  NotionLinkToPageBlock,
  NotionNumberedListItemBlock,
  NotionParagraphBlock,
  NotionPdfBlock,
  NotionQuoteBlock,
  NotionRichText,
  NotionDocument,
  NotionRenderModel,
  NotionTableRowBlock,
  NotionTemplateBlock,
  NotionToDoBlock,
  NotionToggleBlock,
  NotionVideoBlock,
  PageHrefMap,
  PagePreviewMap,
  PrepareNotionRenderModelOptions
} from './types'
import { mapWithConcurrency } from './utils/promisePool'
import {
  buildNotionPublicUrl,
  buildTableOfContents,
  extractNotionPageIdFromUrl,
  getPlainTextFromRichText,
  normalizeCodeLanguage,
  normalizeNotionEntityId,
  normalizeRichTextUrl,
  renderFallbackHighlightedCodeHtml
} from './utils/notion'

const HIGHLIGHT_CONCURRENCY = 4
const LINK_PREVIEW_CONCURRENCY = 4
const LINK_PREVIEW_LIMIT = 48

interface CodeBlockPayload {
  blockId: string
  source: string
  language: string
  normalizedLanguage: string
}

function getBlockRichTextCollections(block: NotionBlock): NotionRichText[][] {
  switch (block.type) {
    case 'paragraph':
      return [block.paragraph.rich_text]
    case 'heading_1':
      return [block.heading_1.rich_text]
    case 'heading_2':
      return [block.heading_2.rich_text]
    case 'heading_3':
      return [block.heading_3.rich_text]
    case 'quote':
      return [block.quote.rich_text]
    case 'callout':
      return [block.callout.rich_text]
    case 'bulleted_list_item':
      return [block.bulleted_list_item.rich_text]
    case 'numbered_list_item':
      return [block.numbered_list_item.rich_text]
    case 'to_do':
      return [block.to_do.rich_text]
    case 'toggle':
      return [block.toggle.rich_text]
    case 'template':
      return [block.template.rich_text]
    case 'embed':
      return [block.embed.caption || []]
    case 'bookmark':
      return [block.bookmark.caption || []]
    case 'image':
      return [block.image.caption || []]
    case 'video':
      return [block.video.caption || []]
    case 'audio':
      return [block.audio.caption || []]
    case 'pdf':
      return [block.pdf.caption || []]
    case 'file':
      return [block.file.caption || []]
    case 'code':
      return [block.code.caption || []]
    case 'table_row':
      return block.table_row.cells
    default:
      return []
  }
}

function getPreviewTargetUrl(block: NotionBlock): string {
  switch (block.type) {
    case 'embed':
      return `${block.embed.url || ''}`.trim()
    case 'bookmark':
      return `${block.bookmark.url || ''}`.trim()
    case 'link_preview':
      return `${block.link_preview.url || ''}`.trim()
    default:
      return ''
  }
}

function getLinkToPageTargetIds(block: NotionBlock): string[] {
  if (block.type !== 'link_to_page') return []
  return [
    block.link_to_page.page_id,
    block.link_to_page.database_id,
    block.link_to_page.block_id,
    block.link_to_page.comment_id
  ].filter((value): value is string => Boolean(value))
}

function collectCodeBlockPayloads(document: NotionDocument): CodeBlockPayload[] {
  const payloads: CodeBlockPayload[] = []
  for (const block of Object.values(document.blocksById || {})) {
    if (!block || block.type !== 'code') continue
    const language = `${block.code.language || ''}`.trim()
    payloads.push({
      blockId: block.id,
      source: getPlainTextFromRichText(block.code.rich_text),
      language,
      normalizedLanguage: normalizeCodeLanguage(language)
    })
  }
  return payloads
}

function addPreviewCandidateUrl(candidateUrls: Set<string>, rawUrl: string | null | undefined) {
  const normalized = normalizeRichTextUrl(`${rawUrl || ''}`.trim())
  if (normalized) candidateUrls.add(normalized)
}

function isMentionRichText(item: NotionRichText): item is Extract<NotionRichText, { type: 'mention' }> {
  return item.type === 'mention'
}

function collectPreviewUrlsFromRichText(richText: unknown, candidateUrls: Set<string>) {
  if (!Array.isArray(richText)) return
  for (const item of richText) {
    if (!item || typeof item !== 'object') continue
    if (!isMentionRichText(item)) continue
    if (item.mention?.type === 'link_preview') {
      addPreviewCandidateUrl(candidateUrls, item.mention.link_preview?.url || item.href)
      continue
    }
    if (item.mention?.type === 'link_mention') {
      addPreviewCandidateUrl(candidateUrls, item.mention.link_mention?.href || item.href)
    }
  }
}

function collectPageHrefCandidateIdsFromRichText(richText: unknown, candidateIds: Set<string>) {
  if (!Array.isArray(richText)) return
  for (const item of richText) {
    const rawCandidates = [
      item?.href,
      item?.type === 'text' ? item.text?.link?.url : '',
      item?.type === 'mention' && item.mention?.type === 'link_mention' ? item.mention.link_mention?.href : ''
    ]

    for (const rawCandidate of rawCandidates) {
      const normalized = extractNotionPageIdFromUrl(rawCandidate)
      if (normalized) candidateIds.add(normalized)
    }
  }
}

function collectPreviewCandidateUrls(document: NotionDocument): string[] {
  const candidateUrls = new Set<string>()
  for (const block of Object.values(document.blocksById || {})) {
    if (!block || typeof block !== 'object') continue

    const previewUrl = getPreviewTargetUrl(block)
    if (previewUrl) {
      addPreviewCandidateUrl(candidateUrls, previewUrl)
    }

    for (const richText of getBlockRichTextCollections(block)) {
      collectPreviewUrlsFromRichText(richText, candidateUrls)
    }
  }
  return Array.from(candidateUrls)
}

function collectPageHrefCandidateIds(document: NotionDocument): string[] {
  const ids = new Set<string>()
  for (const block of Object.values(document.blocksById || {})) {
    if (!block) continue
    for (const raw of getLinkToPageTargetIds(block)) {
      const normalized = normalizeNotionEntityId(raw)
      if (normalized) ids.add(normalized)
    }
    if (block.type === 'child_page' || block.type === 'child_database') {
      const normalized = normalizeNotionEntityId(block.id)
      if (normalized) ids.add(normalized)
    }

    for (const richText of getBlockRichTextCollections(block)) {
      collectPageHrefCandidateIdsFromRichText(richText, ids)
    }
  }
  return Array.from(ids)
}

async function buildHighlightedCodeMap(
  document: NotionDocument,
  options: PrepareNotionRenderModelOptions
): Promise<Record<string, HighlightedCode>> {
  const codeBlocks = collectCodeBlockPayloads(document)
  const highlightTargets = codeBlocks.filter(block => block.normalizedLanguage !== 'mermaid')
  if (!highlightTargets.length) return {}

  if (!options.highlightCode) {
    return Object.fromEntries(highlightTargets.map((block) => [
      block.blockId,
      {
        html: renderFallbackHighlightedCodeHtml(block.source),
        language: block.normalizedLanguage || 'plaintext',
        displayLanguage: block.language || 'plain text'
      }
    ]))
  }

  const uniquePairs = new Map<string, { source: string, language: string, normalizedLanguage: string }>()
  for (const block of highlightTargets) {
    const key = `${block.normalizedLanguage}\u0000${block.source}`
    if (!uniquePairs.has(key)) {
      uniquePairs.set(key, {
        source: block.source,
        language: block.language,
        normalizedLanguage: block.normalizedLanguage
      })
    }
  }

  const highlightedPairs = await mapWithConcurrency(
    Array.from(uniquePairs.entries()),
    HIGHLIGHT_CONCURRENCY,
    async ([pairKey, pair]) => {
      const highlighted = await options.highlightCode!(pair.source, pair.language)
      const resolved = highlighted
        ? {
            html: highlighted.html,
            language: pair.normalizedLanguage || 'plaintext',
            displayLanguage: highlighted.displayLanguage || pair.language || 'plain text'
          }
        : {
            html: renderFallbackHighlightedCodeHtml(pair.source),
            language: pair.normalizedLanguage || 'plaintext',
            displayLanguage: pair.language || 'plain text'
          }

      return [pairKey, resolved] as const
    }
  )

  const byPair = new Map<string, HighlightedCode>(highlightedPairs)
  return Object.fromEntries(highlightTargets.map((block) => {
    const key = `${block.normalizedLanguage}\u0000${block.source}`
    return [block.blockId, byPair.get(key)!]
  }))
}

async function buildResolvedLinkPreviewMap(
  document: NotionDocument,
  options: PrepareNotionRenderModelOptions
): Promise<LinkPreviewMap> {
  const resolved: LinkPreviewMap = { ...(options.initialLinkPreviewMap || {}) }
  if (!options.resolveLinkPreview) return resolved

  const fetchTargets = collectPreviewCandidateUrls(document)
    .filter(url => !resolved[url])
    .slice(0, LINK_PREVIEW_LIMIT)

  const entries = await mapWithConcurrency(fetchTargets, LINK_PREVIEW_CONCURRENCY, async (url) => {
    try {
      return [url, await options.resolveLinkPreview!(url)] as const
    } catch {
      return [url, null] as const
    }
  })

  for (const [url, preview] of entries) {
    if (preview) resolved[url] = preview
  }
  return resolved
}

async function buildResolvedPageHrefMap(
  pageIds: string[],
  options: PrepareNotionRenderModelOptions
): Promise<PageHrefMap> {
  const resolved: PageHrefMap = { ...(options.initialPageHrefMap || {}) }
  if (!pageIds.length) return resolved

  for (const id of pageIds) {
    if (resolved[id]) continue
    if (!options.resolvePageHref) {
      resolved[id] = buildNotionPublicUrl(id)
      continue
    }

    try {
      const href = await options.resolvePageHref(id)
      resolved[id] = href || buildNotionPublicUrl(id)
    } catch {
      resolved[id] = buildNotionPublicUrl(id)
    }
  }

  return resolved
}

function buildResolvedPagePreviewMap(
  pageIds: string[],
  options: PrepareNotionRenderModelOptions
): PagePreviewMap {
  const resolved: PagePreviewMap = { ...(options.initialPagePreviewMap || {}) }
  if (!pageIds.length) return resolved
  const pageIdSet = new Set(pageIds)

  for (const id of Object.keys(resolved)) {
    if (pageIdSet.has(id)) continue
    delete resolved[id]
  }

  return resolved
}

export async function prepareNotionRenderModel(
  document: NotionDocument | null,
  options: PrepareNotionRenderModelOptions = {}
): Promise<NotionRenderModel | null> {
  if (!document) return null

  const toc = document.toc?.length ? document.toc : buildTableOfContents(document)
  const enrichedDocument: NotionDocument = {
    ...document,
    toc
  }
  const pageIds = collectPageHrefCandidateIds(enrichedDocument)
  const pagePreviewMap = buildResolvedPagePreviewMap(pageIds, options)

  const [highlightedCodeByBlockId, linkPreviewMap, pageHrefMap] = await Promise.all([
    buildHighlightedCodeMap(enrichedDocument, options),
    buildResolvedLinkPreviewMap(enrichedDocument, options),
    buildResolvedPageHrefMap(pageIds, options)
  ])

  return {
    document: enrichedDocument,
    toc,
    highlightedCodeByBlockId,
    linkPreviewMap,
    pageHrefMap,
    pagePreviewMap
  }
}

export {
  buildNotionDirectoryTree,
  buildNotionDirectoryTreeSnapshot,
  refreshNotionDirectoryTreeSnapshot
} from './directoryTree'
