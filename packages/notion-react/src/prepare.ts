import type {
  HighlightedCode,
  LinkPreviewMap,
  NotionDocument,
  NotionRenderModel,
  PageHrefMap,
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

function collectCodeBlockPayloads(document: NotionDocument): CodeBlockPayload[] {
  const payloads: CodeBlockPayload[] = []
  for (const block of Object.values(document.blocksById || {})) {
    if (!block || block.type !== 'code') continue
    const language = `${(block as any).code?.language || ''}`.trim()
    payloads.push({
      blockId: block.id,
      source: getPlainTextFromRichText((block as any).code?.rich_text || []),
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

    switch (block.type) {
      case 'embed':
        addPreviewCandidateUrl(candidateUrls, (block as any).embed?.url)
        break
      case 'bookmark':
        addPreviewCandidateUrl(candidateUrls, (block as any).bookmark?.url)
        break
      case 'link_preview':
        addPreviewCandidateUrl(candidateUrls, (block as any).link_preview?.url)
        break
      case 'table_row':
        for (const cell of (block as any).table_row?.cells || []) {
          collectPreviewUrlsFromRichText(cell, candidateUrls)
        }
        break
      default:
        break
    }

    collectPreviewUrlsFromRichText((block as Record<string, any>).paragraph?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).heading_1?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).heading_2?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).heading_3?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).quote?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).callout?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).bulleted_list_item?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).numbered_list_item?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).to_do?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).toggle?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).template?.rich_text, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).embed?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).bookmark?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).image?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).video?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).audio?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).pdf?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).file?.caption, candidateUrls)
    collectPreviewUrlsFromRichText((block as Record<string, any>).code?.caption, candidateUrls)
  }
  return Array.from(candidateUrls)
}

function collectPageHrefCandidateIds(document: NotionDocument): string[] {
  const ids = new Set<string>()
  for (const block of Object.values(document.blocksById || {})) {
    if (!block) continue
    if (block.type === 'link_to_page') {
      for (const raw of [
        (block as any).link_to_page?.page_id,
        (block as any).link_to_page?.database_id,
        (block as any).link_to_page?.block_id,
        (block as any).link_to_page?.comment_id
      ]) {
        const normalized = normalizeNotionEntityId(raw)
        if (normalized) ids.add(normalized)
      }
    }
    if (block.type === 'child_page' || block.type === 'child_database') {
      const normalized = normalizeNotionEntityId(block.id)
      if (normalized) ids.add(normalized)
    }

    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).paragraph?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).heading_1?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).heading_2?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).heading_3?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).quote?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).callout?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).bulleted_list_item?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).numbered_list_item?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).to_do?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).toggle?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).template?.rich_text, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).embed?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).bookmark?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).image?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).video?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).audio?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).pdf?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).file?.caption, ids)
    collectPageHrefCandidateIdsFromRichText((block as Record<string, any>).code?.caption, ids)
    if (block.type === 'table_row') {
      for (const cell of (block as any).table_row?.cells || []) {
        collectPageHrefCandidateIdsFromRichText(cell, ids)
      }
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
  document: NotionDocument,
  options: PrepareNotionRenderModelOptions
): Promise<PageHrefMap> {
  const resolved: PageHrefMap = { ...(options.initialPageHrefMap || {}) }
  const ids = collectPageHrefCandidateIds(document)
  if (!ids.length) return resolved

  for (const id of ids) {
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

  const [highlightedCodeByBlockId, linkPreviewMap, pageHrefMap] = await Promise.all([
    buildHighlightedCodeMap(enrichedDocument, options),
    buildResolvedLinkPreviewMap(enrichedDocument, options),
    buildResolvedPageHrefMap(enrichedDocument, options)
  ])

  return {
    document: enrichedDocument,
    toc,
    highlightedCodeByBlockId,
    linkPreviewMap,
    pageHrefMap
  }
}
