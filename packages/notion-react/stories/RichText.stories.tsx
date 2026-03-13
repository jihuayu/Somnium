import type { Meta, StoryObj } from '@storybook/react'
import { RichText } from '../src'
import { demoRichText, demoModel } from './fixtures'

const meta = {
  title: 'Renderer/RichText',
  component: RichText,
  tags: ['autodocs'],
  args: {
    richText: demoRichText,
    linkPreviewMap: demoModel.linkPreviewMap,
    renderOptions: {
      locale: 'zh-CN',
      timeZone: 'Asia/Shanghai',
      dateMention: {
        displayMode: 'relative',
        includeTime: 'always',
        absoluteDateFormat: 'YYYY年M月D日',
        absoluteDateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
        relativeStyle: 'short'
      }
    }
  },
  render: (args) => (
    <div className="max-w-xl text-[17px] leading-8 text-zinc-900 dark:text-zinc-100">
      <RichText {...args} />
    </div>
  )
} satisfies Meta<typeof RichText>

export default meta

type Story = StoryObj<typeof meta>

export const Mentions: Story = {}
