import { defineComponent, h, ref, onMounted, onBeforeUnmount, watch } from 'vue'
import cn from 'classnames'
import type { MermaidBlockProps } from '../types'

type MermaidModule = typeof import('mermaid')
let mermaidModulePromise: Promise<MermaidModule> | null = null

async function getMermaid() {
  if (!mermaidModulePromise) mermaidModulePromise = import('mermaid')
  const loadedModule = await mermaidModulePromise
  return loadedModule.default
}

function isDarkMode() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
}

function sanitizeRenderedSvg(svg: string): string {
  if (typeof DOMParser === 'undefined') return svg

  const documentNode = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const root = documentNode.documentElement
  if (!root || root.nodeName.toLowerCase() === 'parsererror') {
    throw new Error('Failed to sanitize Mermaid SVG')
  }

  for (const selector of ['script', 'foreignObject', 'iframe', 'object', 'embed']) {
    for (const element of Array.from(root.querySelectorAll(selector))) {
      element.remove()
    }
  }

  for (const element of Array.from(root.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on')) {
        element.removeAttribute(attribute.name)
        continue
      }
      if ((name === 'href' || name === 'xlink:href') && /^javascript:/i.test(value)) {
        element.removeAttribute(attribute.name)
      }
    }
  }

  return root.outerHTML
}

let componentCounter = 0

export default defineComponent({
  name: 'MermaidBlock',
  props: {
    code: { type: String, required: true },
    class: { type: String, default: '' }
  },
  setup(props) {
    const localId = `mermaid_${++componentCounter}`
    const hostRef = ref<HTMLDivElement | null>(null)
    const containerRef = ref<HTMLDivElement | null>(null)
    const renderTokenRef = { current: 0 }
    const renderError = ref('')
    const themeVersion = ref(0)
    const shouldRender = ref(false)

    let intersectionObserver: IntersectionObserver | null = null
    let themeObserver: MutationObserver | null = null
    let idleId: number | null = null
    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let themeCleanup: (() => void) | null = null
    let renderCleanup: (() => void) | null = null

    function scheduleActivate() {
      if (typeof window !== 'undefined' && window.requestIdleCallback) {
        idleId = window.requestIdleCallback(() => { shouldRender.value = true }, { timeout: 1200 })
      } else {
        idleTimer = globalThis.setTimeout(() => { shouldRender.value = true }, 160)
      }
    }

    onMounted(() => {
      if (!hostRef.value) return

      intersectionObserver = new IntersectionObserver((entries) => {
        if (!entries.some(entry => entry.isIntersecting)) return
        intersectionObserver?.disconnect()
        intersectionObserver = null
        scheduleActivate()
      }, { root: null, rootMargin: '240px 0px', threshold: 0.01 })
      intersectionObserver.observe(hostRef.value)

      if (typeof document !== 'undefined') {
        themeObserver = new MutationObserver((records) => {
          for (const record of records) {
            if (record.type === 'attributes' && record.attributeName === 'class') {
              themeVersion.value += 1
              break
            }
          }
        })
        themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      }
    })

    onBeforeUnmount(() => {
      intersectionObserver?.disconnect()
      themeObserver?.disconnect()
      if (idleId !== null && typeof window !== 'undefined' && window.cancelIdleCallback) window.cancelIdleCallback(idleId)
      if (idleTimer !== null) globalThis.clearTimeout(idleTimer)
      themeCleanup?.()
      renderCleanup?.()
    })

    watch([() => props.code, shouldRender, themeVersion], async ([code, render]) => {
      if (!render || typeof document === 'undefined') return
      renderCleanup?.()
      let cancelled = false
      const renderToken = renderTokenRef.current + 1
      renderTokenRef.current = renderToken
      renderCleanup = () => { cancelled = true }

      const container = containerRef.value
      if (!container || !container.isConnected) return
      const source = `${code || ''}`.trim()

      if (!source) {
        container.innerHTML = ''
        renderError.value = ''
        return
      }

      try {
        container.innerHTML = ''
        const mermaid = await getMermaid()
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: isDarkMode() ? 'dark' : 'default' })
        const { svg, bindFunctions } = await mermaid.render(`${localId}_${themeVersion.value}_${renderToken}`, source, container)
        if (cancelled || renderTokenRef.current !== renderToken || !container.isConnected || containerRef.value !== container) return
        container.innerHTML = sanitizeRenderedSvg(svg)
        bindFunctions?.(container)
        renderError.value = ''
      } catch (error) {
        if (cancelled || renderTokenRef.current !== renderToken) return
        if (error instanceof DOMException && error.name === 'NoModificationAllowedError') return
        if (containerRef.value?.isConnected) containerRef.value.innerHTML = ''
        renderError.value = error instanceof Error ? error.message : 'Failed to render Mermaid diagram'
      }
    })

    return () => {
      const blockClass = cn('notion-mermaid-block', props.class)

      if (renderError.value) {
        return h('div', { ref: hostRef, class: blockClass }, [
          h('pre', { class: 'overflow-x-auto p-3 text-sm text-zinc-900 dark:text-zinc-100' }, [
            h('code', props.code)
          ]),
          h('p', { class: 'px-3 pb-3 text-xs text-red-600 dark:text-red-400' }, `Mermaid render error: ${renderError.value}`)
        ])
      }

      return h('div', { ref: hostRef, class: blockClass }, [
        shouldRender.value
          ? h('div', { ref: containerRef, class: 'notion-mermaid-svg' })
          : h('pre', { class: 'overflow-x-auto p-3 text-sm text-zinc-500 dark:text-zinc-400' }, [
              h('code', 'Mermaid diagram deferred')
            ])
      ])
    }
  }
})
