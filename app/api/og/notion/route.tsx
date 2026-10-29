import { config } from '@/lib/server/config'
import { fetchCoverDataUrl, getPublishedPageOgData, loadOgFonts } from '@/lib/server/notionOg'
import { createBufferedNotionOgImageResponse, normalizeOgText } from '@/lib/server/notionOgImage'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pageId = `${searchParams.get('pageId') || ''}`.trim()

  if (!pageId) {
    return new Response('Missing pageId', { status: 400 })
  }

  let page = null
  try {
    page = await getPublishedPageOgData(pageId)
  } catch (error) {
    console.error('[og] Atrium OG lookup failed', { pageId, error })
    return new Response('Blog content unavailable', {
      status: 503,
      headers: { 'cache-control': 'no-store' }
    })
  }

  if (!page) {
    return new Response('Not found', {
      status: 404,
      headers: { 'cache-control': 'no-store' }
    })
  }

  const title = normalizeOgText(page.title || config.title, 120) || config.title
  const summary = normalizeOgText(page.summary || '', 240)
  let coverDataUrl = ''

  if (page.coverUrl) {
    try {
      coverDataUrl = await fetchCoverDataUrl(page.coverUrl)
    } catch (error) {
      console.error(`[og] Failed to fetch cover for page ${pageId}:`, error)
    }
  }

  let fonts: Awaited<ReturnType<typeof loadOgFonts>> = []
  try {
    fonts = await loadOgFonts([title, summary, config.title])
  } catch (error) {
    console.error(`[og] Failed to load OG fonts for page ${pageId}:`, error)
  }

  const fontFamily = fonts.length ? 'NotionOgSans' : 'sans-serif'

  return createBufferedNotionOgImageResponse({
    title,
    coverDataUrl,
    fontFamily,
    fonts,
    onCoverRenderError: (error) => {
      console.error('[og] Failed to render cover image, falling back to title image', {
        pageId,
        error
      })
    },
    onTitleRenderError: (error) => {
      console.error('[og] Failed to render title image, falling back to svg image', {
        pageId,
        error
      })
    }
  })
}
