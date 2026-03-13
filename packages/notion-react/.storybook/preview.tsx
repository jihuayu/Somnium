import type { Preview } from '@storybook/react'
import '../src/storybook.css'

const preview: Preview = {
  globalTypes: {
    colorMode: {
      name: 'Color Mode',
      defaultValue: 'light',
      toolbar: {
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ]
      }
    }
  },
  parameters: {
    layout: 'fullscreen',
    controls: { expanded: true }
  },
  decorators: [
    (Story, context) => {
      const dark = context.globals.colorMode === 'dark'
      if (typeof document !== 'undefined') {
        document.documentElement.classList.toggle('dark', dark)
      }

      return (
        <div className={dark ? 'dark min-h-screen bg-zinc-950 p-8 text-zinc-100' : 'min-h-screen bg-stone-50 p-8 text-zinc-900'}>
          <div className="mx-auto max-w-5xl rounded-2xl border border-zinc-200/80 bg-white px-6 py-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] dark:border-zinc-800 dark:bg-zinc-900">
            <Story />
          </div>
        </div>
      )
    }
  ]
}

export default preview
