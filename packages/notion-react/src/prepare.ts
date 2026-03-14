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
      return [(block as NotionParagraphBlock).paragraph?.rich_text || []]
    case 'heading_1':
      return [(block as NotionHeading1Block).heading_1?.rich_text || []]
    case 'heading_2':
      return [(block as NotionHeading2Block).heading_2?.rich_text || []]
    case 'heading_3':
      return [(block as NotionHeading3Block).heading_3?.rich_text || []]
    case 'quote':
      return [(block as NotionQuoteBlock).quote?.rich_text || []]
    case 'callout':
      return [(block as NotionCalloutBlock).callout?.rich_text || []]
    case 'bulleted_list_item':
      return [(block as NotionBulletedListItemBlock).bulleted_list_item?.rich_text || []]
    case 'numbered_list_item':
      return [(block as NotionNumberedListItemBlock).numbered_list_item?.rich_text || []]
    case 'to_do':
      return [(block as NotionToDoBlock).to_do?.rich_text || []]
    case 'toggle':
      return [(block as NotionToggleBlock).toggle?.rich_text || []]
    case 'template':
      return [(block as NotionTemplateBlock).template?.rich_text || []]
    case 'embed':
      return [(block as NotionEmbedBlock).embed?.caption || []]
    case 'bookmark':
      return [(block as NotionBookmarkBlock).bookmark?.caption || []]
    case 'image':
      return [(block as NotionImageBlock).image?.caption || []]
    case 'video':
      return [(block as NotionVideoBlock).video?.caption || []]
    case 'audio':
      return [(block as NotionAudioBlock).audio?.caption || []]
    case 'pdf':
      return [(block as NotionPdfBlock).pdf?.caption || []]
    case 'file':
      return [(block as NotionFileBlock).file?.caption || []]
    case 'code':
      return [(block as NotionCodeBlock).code?.caption || []]
    case 'table_row':
      return (block as NotionTableRowBlock).table_row?.cells || []
    default:
      return []
  }
}

function getPreviewTargetUrl(block: NotionBlock): string {
  switch (block.type) {
    case 'embed':
      return `${(block as NotionEmbedBlock).embed?.url || ''}`.trim()
    case 'bookmark':
      return `${(block as NotionBookmarkBlock).bookmark?.url || ''}`.trim()
    case 'link_preview':
      return `${(block as NotionLinkPreviewBlock).link_preview?.url || ''}`.trim()
    default:
      return ''
  }
}

function getLinkToPageTargetIds(block: NotionBlock): string[] {
  if (block.type !== 'link_to_page') return []
  const linkToPageBlock = block as NotionLinkToPageBlock
  return [
    linkToPageBlock.link_to_page?.page_id,
    linkToPageBlock.link_to_page?.database_id,
    linkToPageBlock.link_to_page?.block_id,
    linkToPageBlock.link_to_page?.comment_id
  ].filter((value): value is string => Boolean(value))
}

function collectCodeBlockPayloads(document: NotionDocument): CodeBlockPayload[] {
  const payloads: CodeBlockPayload[] = []
  for (const block of Object.values(document.blocksById || {})) {
    if (!block || block.type !== 'code') continue
    const codeBlock = block as NotionCodeBlock
    const language = `${codeBlock.code?.language || ''}`.trim()
    payloads.push({
      blockId: block.id,
      source: getPlainTextFromRichText(codeBlock.code?.rich_text || []),
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

function collectPreviewUrlsFromRichText(richText: unknown, candidateUrls: Set<string>) {
  if (!Array.isArray(richText)) return
  for (const item of richText) {
    if (!item || typeof item !== 'object') continue
    const value = item as {
      type?: string
      mention?: {
        type?: string
        link_preview?: { url?: string }
        link_mention?: { href?: string }
      }
      href?: string
    }
    if (value.type !== 'mention') continue
    if (value.mention?.type === 'link_preview') {
      addPreviewCandidateUrl(candidateUrls, value.mention.link_preview?.url || value.href)
      continue
    }
    if (value.mention?.type === 'link_mention') {
      addPreviewCandidateUrl(candidateUrls, value.mention.link_mention?.href || value.href)
    }
  }
}

function collectPageHrefCandidateIdsFromRichText(richText: unknown, candidateIds: Set<string>) {
  if (!Array.isArray(richText)) return
  for (const item of richText) {
    if (!item || typeof item !== 'object') continue
    const value = item as {
      type?: string
      href?: string
      text?: { link?: { url?: string } | null }
      mention?: {
        type?: string
        link_mention?: { href?: string }
      }
    }

    const rawCandidates = [
      value.href,
      value.type === 'text' ? value.text?.link?.url : '',
      value.mention?.type === 'link_mention' ? value.mention.link_mention?.href : ''
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
