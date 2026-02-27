import type { LinkPreviewData } from '@/lib/link-preview/types'

export interface ParsedLinkPreviewMetadata {
  ogTitle: string
  titleTag: string
  description: string
  image: string
  icon: string
}

export interface LinkPreviewAdapterContext {
  normalizedUrl: string
  resolvedUrl: string
  hostname: string
  parsedUrl: URL
  metadata: ParsedLinkPreviewMetadata
  fallback: LinkPreviewData
}

export interface LinkPreviewAdapter {
  id: string
  matches: (ctx: LinkPreviewAdapterContext) => boolean
  resolve: (ctx: LinkPreviewAdapterContext) => Partial<LinkPreviewData> | null
}

function decodeSegment(input: string): string {
  if (!input) return ''
  try { return decodeURIComponent(input) } catch { return input }
}

function isGithubHost(hostname: string): boolean {
  const host = `${hostname || ''}`.toLowerCase()
  return host === 'github.com' || host === 'www.github.com'
}

const githubLinkPreviewAdapter: LinkPreviewAdapter = {
  id: 'github',
  matches: (ctx) => isGithubHost(ctx.hostname),
  resolve: (ctx) => {
    const segments = ctx.parsedUrl.pathname.split('/').filter(Boolean).map(decodeSegment)
    const title = segments.length >= 2
      ? `${segments[0]}/${segments[1]}`
      : segments.length === 1
        ? segments[0]
        : 'GitHub'

    return {
      url: ctx.resolvedUrl,
      hostname: 'github.com',
      title,
      description: ctx.metadata.description || '',
      image: ctx.metadata.image || '',
      icon: 'https://github.githubassets.com/favicons/favicon.svg'
    }
  }
}

const defaultLinkPreviewAdapter: LinkPreviewAdapter = {
  id: 'default',
  matches: () => true,
  resolve: (ctx) => {
    const title = ctx.metadata.ogTitle || ctx.metadata.titleTag || ctx.fallback.title

    return {
      url: ctx.resolvedUrl,
      hostname: ctx.hostname,
      title,
      description: ctx.metadata.description || '',
      image: ctx.metadata.image || '',
      icon: ctx.metadata.icon || ctx.fallback.icon
    }
  }
}

// Add new domain adapters here. First matching adapter wins.
const SPECIAL_LINK_PREVIEW_ADAPTERS: LinkPreviewAdapter[] = [
  githubLinkPreviewAdapter
]

export function resolveLinkPreviewByAdapter(ctx: LinkPreviewAdapterContext): Partial<LinkPreviewData> {
  const adapter = SPECIAL_LINK_PREVIEW_ADAPTERS.find(item => item.matches(ctx)) || defaultLinkPreviewAdapter
  return adapter.resolve(ctx) || {}
}

