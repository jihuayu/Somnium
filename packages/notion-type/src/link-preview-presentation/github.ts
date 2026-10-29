import { applyCompactSlashTitle, type LinkPreviewPresentation, type LinkPreviewPresentationAdapter } from './types'

const GITHUB_RESERVED_OWNERS = new Set([
  'about',
  'account',
  'apps',
  'auth',
  'codespaces',
  'collections',
  'copilot',
  'customer-stories',
  'discussions',
  'enterprise',
  'events',
  'explore',
  'features',
  'github-copilot',
  'issues',
  'login',
  'logout',
  'marketplace',
  'new',
  'notifications',
  'orgs',
  'organizations',
  'pricing',
  'pulls',
  'readme',
  'security',
  'sessions',
  'settings',
  'signup',
  'site',
  'sponsors',
  'stars',
  'team',
  'topics',
  'watching'
])

const GITHUB_RESOURCE_LABELS: Record<string, string> = {
  actions: 'actions',
  blob: 'repo',
  commit: 'commit',
  commits: 'commit',
  discussions: 'discussion',
  issue: 'issue',
  issues: 'issue',
  projects: 'project',
  pull: 'pull request',
  pulls: 'pull request',
  releases: 'release',
  tree: 'repo',
  wiki: 'wiki'
}

const GITHUB_REPO_OG_RESOURCES = new Set([
  '',
  'blob',
  'branches',
  'commit',
  'commits',
  'graphs',
  'network',
  'pulse',
  'releases',
  'security',
  'tags',
  'tree',
  'wiki'
])

function isGithubHostname(hostname: string): boolean {
  const host = hostname.toLowerCase()
  return host === 'github.com' || host === 'www.github.com'
}

/**
 * EN: GitHub hover-card and mention-label adapter.
 * ZH: GitHub 悬浮卡与提及标签适配器。
 */
export const githubLinkPreviewPresentationAdapter: LinkPreviewPresentationAdapter = {
  id: 'github',
  matches: (ctx) => Boolean(ctx.parsed && isGithubHostname(ctx.parsed.hostname)),
  adapt: (ctx): LinkPreviewPresentation => {
    const owner = ctx.pathSegments[0] || ''
    const repo = ctx.pathSegments[1] || ''
    const resource = `${ctx.pathSegments[2] || ''}`.toLowerCase()
    const ownerKey = owner.toLowerCase()
    const isOwnerValid = Boolean(owner) && !GITHUB_RESERVED_OWNERS.has(ownerKey)
    const isRepo = Boolean(
      isOwnerValid
      && repo
      && repo !== 'followers'
      && repo !== 'following'
      && repo !== 'stars'
    )

    let resourceLabel = ''
    if (isRepo) {
      resourceLabel = GITHUB_RESOURCE_LABELS[resource] || 'repo'
    } else if (owner) {
      resourceLabel = 'profile'
    }

    const previewKind = isRepo && GITHUB_REPO_OG_RESOURCES.has(resource)
      ? 'github-repo'
      : 'github'

    const title = isRepo && previewKind === 'github-repo'
      ? { titlePrefix: `${owner}/`, titleName: repo }
      : applyCompactSlashTitle(ctx.fallbackTitle)

    return {
      adapterId: 'github',
      previewKind,
      titlePrefix: title.titlePrefix,
      titleName: title.titleName,
      providerLabel: resourceLabel ? `github.com · ${resourceLabel}` : 'github.com'
    }
  },
  getMentionLabel: (ctx) => ctx.pathSegments.length >= 2 ? ctx.pathSegments[1] : null
}
