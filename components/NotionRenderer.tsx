import { FONTS_MISANS } from '@/consts'
import {
  NotionRenderer as BaseNotionRenderer,
  type NotionRenderModel,
  type NotionRenderOptions,
  type PagePreviewMap
} from '@/packages/notion-react/src'
import { config } from '@/lib/server/config'

interface NotionRendererProps {
  model: NotionRenderModel | null
}

function buildRenderOptions(): NotionRenderOptions {
  const notionDateMention = config.notionDateMention || {
    display: 'relative',
    includeTime: 'always',
    absoluteDateFormat: 'YYYY年M月D日',
    absoluteDateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
    relativeStyle: 'short'
  }

  return {
    locale: config.lang,
    timeZone: config.timezone,
    dateMention: {
      displayMode: notionDateMention.display,
      includeTime: notionDateMention.includeTime,
      absoluteDateFormat: notionDateMention.absoluteDateFormat,
      absoluteDateTimeFormat: notionDateMention.absoluteDateTimeFormat,
      relativeStyle: notionDateMention.relativeStyle
    }
  }
}

export default function NotionRenderer({ model }: NotionRendererProps) {
  if (!model) return null

  return (
    <BaseNotionRenderer
      model={model}
      renderOptions={buildRenderOptions()}
      style={{ ['--notion-font-family' as string]: FONTS_MISANS.join(', ') }}
    />
  )
}
