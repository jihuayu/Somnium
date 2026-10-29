import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createLinkPreviewPresentationResolver,
  getLinkPreviewPresentation,
  getUrlMentionLabel
} from '../src'

test('getLinkPreviewPresentation formats GitHub repository cards', () => {
  const repo = getLinkPreviewPresentation(
    'https://github.com/Afilmory/afilmory',
    'Afilmory/afilmory',
    'github.com'
  )

  assert.deepEqual(repo, {
    adapterId: 'github',
    previewKind: 'github-repo',
    titlePrefix: 'Afilmory/',
    titleName: 'afilmory',
    providerLabel: 'github.com · repo'
  })
})

test('getLinkPreviewPresentation keeps GitHub issue titles and labels the provider', () => {
  const issue = getLinkPreviewPresentation(
    'https://github.com/Afilmory/afilmory/issues/12',
    'Fix hover card overflow',
    'github.com'
  )

  assert.deepEqual(issue, {
    adapterId: 'github',
    previewKind: 'github',
    titlePrefix: '',
    titleName: 'Fix hover card overflow',
    providerLabel: 'github.com · issue'
  })
})

test('getLinkPreviewPresentation uses owner/repo from the URL even when OG title is short', () => {
  const repo = getLinkPreviewPresentation(
    'https://www.github.com/jihuayu/somnium',
    'somnium',
    'github.com'
  )

  assert.equal(repo.adapterId, 'github')
  assert.equal(repo.previewKind, 'github-repo')
  assert.equal(repo.titlePrefix, 'jihuayu/')
  assert.equal(repo.titleName, 'somnium')
  assert.equal(repo.providerLabel, 'github.com · repo')
})

test('getLinkPreviewPresentation falls back to hostname for generic links', () => {
  const preview = getLinkPreviewPresentation(
    'https://storybook.js.org/docs',
    'Storybook Docs',
    'storybook.js.org'
  )

  assert.deepEqual(preview, {
    adapterId: 'default',
    previewKind: 'default',
    titlePrefix: '',
    titleName: 'Storybook Docs',
    providerLabel: 'storybook.js.org'
  })
})

test('getUrlMentionLabel uses the GitHub adapter for repository chips', () => {
  assert.equal(
    getUrlMentionLabel('https://github.com/Afilmory/afilmory', 'https://github.com/Afilmory/afilmory'),
    'afilmory'
  )
  assert.equal(
    getUrlMentionLabel('https://example.com/docs/guide', 'https://example.com/docs/guide'),
    'guide'
  )
  assert.equal(getUrlMentionLabel('https://github.com/Afilmory/afilmory', 'Custom title'), 'Custom title')
})

test('createLinkPreviewPresentationResolver lets a later site adapter win without touching GitHub', () => {
  const resolver = createLinkPreviewPresentationResolver([
    {
      id: 'example',
      matches: (ctx) => ctx.hostLabel === 'example.com',
      adapt: () => ({
        adapterId: 'example',
        previewKind: 'example',
        titlePrefix: '',
        titleName: 'Example Card',
        providerLabel: 'example.com'
      }),
      getMentionLabel: () => 'example-chip'
    }
  ])

  const example = resolver.getPresentation('https://example.com/docs', 'Ignored', 'example.com')
  assert.deepEqual(example, {
    adapterId: 'example',
    previewKind: 'example',
    titlePrefix: '',
    titleName: 'Example Card',
    providerLabel: 'example.com'
  })
  assert.equal(resolver.getMentionLabel('https://example.com/docs', 'https://example.com/docs'), 'example-chip')

  const generic = resolver.getPresentation('https://storybook.js.org/docs', 'Storybook Docs', 'storybook.js.org')
  assert.equal(generic.adapterId, 'default')
  assert.equal(generic.titleName, 'Storybook Docs')
})
