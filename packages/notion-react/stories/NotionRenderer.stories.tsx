import type { Meta, StoryObj } from '@storybook/react'
import { NotionRenderer } from '../src'
import { demoModel } from './fixtures'

const meta = {
  title: 'Renderer/NotionRenderer',
  component: NotionRenderer,
  parameters: {
    layout: 'padded'
  },
  tags: ['autodocs'],
  args: {
    model: demoModel
  }
} satisfies Meta<typeof NotionRenderer>

export default meta

type Story = StoryObj<typeof meta>

export const FullDocument: Story = {}

export const CompactCanvas: Story = {
  args: {
    className: 'max-w-2xl'
  }
}
