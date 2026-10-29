import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createSSRApp, h, ref } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { getLinkPreviewPresentation } from '@jihuayu/notion-type'
import LinkPreviewCard from '../src/components/LinkPreviewCard'
import { renderUrlMentionHoverCard } from '../src/components/UrlMentionHoverCard'

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/components')
const githubUrl = 'https://github.com/jihuayu/Somnium'
const githubPreview = {
  url: githubUrl,
  hostname: 'github.com',
  title: 'jihuayu/Somnium',
  description: 'A static blog build on top of Notion and NextJS, deployed on Vercel. - jihuayu/Somnium',
  image: 'https://opengraph.githubassets.com/hash/repo',
  icon: 'https://github.com/fluidicon.png'
}

test('Vue LinkPreviewCard source stays decoupled from floating hover cards', () => {
  const source = readFileSync(path.join(srcDir, 'LinkPreviewCard.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(source, /getLinkPreviewPresentation/)
  assert.doesNotMatch(source, /notion-url-mention-hover/)
  assert.doesNotMatch(source, /UrlMentionHoverCard/)
})

test('Vue LinkPreviewCard keeps the in-page 110px bookmark layout', async () => {
  const app = createSSRApp({
    render: () => h(LinkPreviewCard, { url: githubUrl, preview: githubPreview })
  })
  const html = await renderToString(app)

  assert.match(html, /data-link-preview-card="true"/)
  assert.match(html, /h-\[110px\]/)
  assert.match(html, /https:\/\/github.com\/jihuayu\/Somnium/)
  assert.doesNotMatch(html, /github\.com · repo/)
  assert.doesNotMatch(html, /notion-url-mention-hover-card/)
  assert.doesNotMatch(html, /data-preview-kind/)
})

test('Vue UrlMentionHoverCard is the only GitHub-style floating preview', async () => {
  const app = createSSRApp({
    setup() {
      return () => renderUrlMentionHoverCard({
        preview: {
          href: githubUrl,
          title: githubPreview.title,
          description: githubPreview.description,
          icon: githubPreview.icon,
          image: githubPreview.image,
          provider: githubPreview.hostname
        },
        presentation: getLinkPreviewPresentation(githubUrl, githubPreview.title, githubPreview.hostname),
        providerIcon: h('span'),
        cardRef: ref(null),
        floatingStyle: {},
        onOpen() {},
        onClose() {},
        onBlur() {}
      })
    }
  })
  const html = await renderToString(app)

  assert.match(html, /notion-url-mention-hover-card/)
  assert.match(html, /data-preview-kind="github-repo"/)
  assert.match(html, /github\.com · repo/)
  assert.doesNotMatch(html, /h-\[110px\]/)
  assert.doesNotMatch(html, /data-link-preview-card/)
})
