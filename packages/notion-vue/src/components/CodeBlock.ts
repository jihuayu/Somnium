import { defineComponent, h, onBeforeUnmount, ref, watch } from 'vue'
import CodeBlockCopyButton from './CodeBlockCopyButton'

/** Delay before an overflowing code block lifts into its floating state. */
const EXPAND_DELAY_MS = 240
/** Time reserved for the collapse transition before the inline width is dropped. */
const COLLAPSE_RESET_MS = 520
/** Safe gap kept between the floating code block and the viewport edges. */
const VIEWPORT_PADDING = 24
/** Overflow smaller than this is treated as rounding noise. */
const OVERFLOW_EPSILON = 2

function measureOverflow(block: HTMLElement): number {
  let overflow = 0
  for (const scroller of block.querySelectorAll<HTMLElement>('.notion-code-content, .notion-code-content pre')) {
    overflow = Math.max(overflow, scroller.scrollWidth - scroller.clientWidth)
  }
  return overflow
}

export default defineComponent({
  name: 'CodeBlock',
  props: {
    contentId: { type: String, required: true },
    displayLanguage: { type: String, required: true },
    codeHtml: { type: String, required: true }
  },
  setup(props) {
    const blockRef = ref<HTMLElement | null>(null)
    const expanded = ref(false)
    let expandTimer: ReturnType<typeof setTimeout> | undefined
    let resetTimer: ReturnType<typeof setTimeout> | undefined
    let restWidth = 0
    let restLeft = 0

    const clearExpandTimer = () => {
      if (expandTimer === undefined) return
      clearTimeout(expandTimer)
      expandTimer = undefined
    }

    const clearResetTimer = () => {
      if (resetTimer === undefined) return
      clearTimeout(resetTimer)
      resetTimer = undefined
    }

    const expand = () => {
      expandTimer = undefined
      const block = blockRef.value
      if (!block || expanded.value) return

      const overflow = measureOverflow(block)
      if (overflow <= OVERFLOW_EPSILON) return

      // An inline width means a collapse transition is still running, so the
      // cached resting geometry is the only reliable anchor.
      const rect = block.getBoundingClientRect()
      if (!block.style.width) {
        restWidth = rect.width
        restLeft = rect.left
      }

      const viewportWidth = document.documentElement.clientWidth
      const roomiestWidth = Math.max(restWidth, viewportWidth - VIEWPORT_PADDING * 2)
      const targetWidth = Math.max(restWidth, Math.min(rect.width + overflow, roomiestWidth))
      if (targetWidth - restWidth <= OVERFLOW_EPSILON) return

      // Slide left only when growing rightwards alone would leave the viewport.
      const overshoot = restLeft + targetWidth - (viewportWidth - VIEWPORT_PADDING)
      const shift = Math.max(0, Math.min(overshoot, restLeft - VIEWPORT_PADDING))

      clearResetTimer()
      // Pin the current width, flush layout, then animate towards the target:
      // width cannot transition away from `auto`.
      block.style.width = `${rect.width}px`
      block.getBoundingClientRect()
      block.style.width = `${targetWidth}px`
      block.style.transform = shift > 0 ? `translateX(${-shift}px)` : ''
      expanded.value = true
    }

    const collapse = (animate = true) => {
      clearExpandTimer()
      const block = blockRef.value
      if (!block || !expanded.value) return

      expanded.value = false
      block.style.transform = ''
      clearResetTimer()

      if (!animate) {
        block.style.width = ''
        return
      }

      block.style.width = `${restWidth}px`
      resetTimer = setTimeout(() => {
        resetTimer = undefined
        if (expanded.value || !blockRef.value) return
        blockRef.value.style.width = ''
      }, COLLAPSE_RESET_MS)
    }

    const handlePointerEnter = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      clearExpandTimer()
      expandTimer = setTimeout(expand, EXPAND_DELAY_MS)
    }

    // Cached geometry is only valid for the current viewport, so drop the
    // floating state instead of animating towards a stale width.
    const handleViewportChange = () => collapse(false)

    watch(expanded, value => {
      if (typeof window === 'undefined') return
      if (value) window.addEventListener('resize', handleViewportChange)
      else window.removeEventListener('resize', handleViewportChange)
    })

    onBeforeUnmount(() => {
      clearExpandTimer()
      clearResetTimer()
      if (typeof window !== 'undefined') window.removeEventListener('resize', handleViewportChange)
    })

    return () => h('div', {
      ref: blockRef,
      class: ['notion-code-block my-5 overflow-hidden', expanded.value ? 'notion-code-block-expanded' : ''],
      onPointerenter: handlePointerEnter,
      onPointerleave: () => collapse()
    }, [
      h('span', { class: 'notion-code-language notion-code-language-floating' }, props.displayLanguage),
      h(CodeBlockCopyButton, { codeSelector: `#${props.contentId} code` }),
      h('div', {
        id: props.contentId,
        class: 'notion-code-content',
        innerHTML: props.codeHtml
      })
    ])
  }
})
