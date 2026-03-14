'use client'

import {
  NotionRenderer as BaseNotionRenderer,
  type NotionRenderModel,
  type NotionRenderOptions
} from '@jihuayu/notion-react/client'
import { FONTS_MISANS } from '@/consts'

interface NotionRendererClientProps {
  model: NotionRenderModel
  renderOptions: NotionRenderOptions
}

export default function NotionRendererClient({ model, renderOptions }: NotionRendererClientProps) {
  return (
    <BaseNotionRenderer
      model={model}
      renderOptions={renderOptions}
      style={{ ['--notion-font-family' as string]: FONTS_MISANS.join(', ') }}
    />
  )
}