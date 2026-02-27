'use client'

import { useEffect, useId, useRef, useState } from 'react'
import cn from 'classnames'

interface MermaidBlockProps {
  code: string
  className?: string
}

type MermaidModule = typeof import('mermaid')
let mermaidModulePromise: Promise<MermaidModule> | null = null

async function getMermaid() {
  if (!mermaidModulePromise) {
    mermaidModulePromise = import('mermaid')
  }
  const loadedModule = await mermaidModulePromise
  return loadedModule.default
}

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export default function MermaidBlock({ code, className }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderTokenRef = useRef(0)
  const [renderError, setRenderError] = useState('')
  const [themeVersion, setThemeVersion] = useState(0)
  const localId = useId().replaceAll(':', '_')

  useEffect(() => {
    if (typeof document === 'undefined') return

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === 'attributes' && record.attributeName === 'class') {
          setThemeVersion(value => value + 1)
          break
        }
      }
    })

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class']
    })

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    const renderToken = renderTokenRef.current + 1
    renderTokenRef.current = renderToken

    async function renderDiagram() {
      const container = containerRef.current
      if (!container || !container.isConnected) return

      const source = `${code || ''}`.trim()
      if (!source) {
        container.innerHTML = ''
        setRenderError('')
        return
      }

      try {
        container.innerHTML = ''
        const mermaid = await getMermaid()

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDarkMode() ? 'dark' : 'default'
        })

        // 将当前容器传给 Mermaid，避免内部在脱离父节点的元素上做 DOM 插入。
        const { svg, bindFunctions } = await mermaid.render(
          `mermaid-${localId}-${themeVersion}-${renderToken}`,
          source,
          container
        )
        if (
          cancelled ||
          renderTokenRef.current !== renderToken ||
          !container.isConnected ||
          containerRef.current !== container
        ) {
          return
        }

        container.innerHTML = svg
        bindFunctions?.(container)
        setRenderError('')
      } catch (error) {
        if (cancelled || renderTokenRef.current !== renderToken) return

        // 组件卸载/切页时，Mermaid 内部可能在已脱离 DOM 的节点上操作，忽略这类竞态错误。
        if (error instanceof DOMException && error.name === 'NoModificationAllowedError') {
          return
        }

        if (containerRef.current && containerRef.current.isConnected) {
          containerRef.current.innerHTML = ''
        }

        const message = error instanceof Error
          ? error.message
          : 'Failed to render Mermaid diagram'
        setRenderError(message)
      }
    }

    renderDiagram()

    return () => {
      cancelled = true
    }
  }, [code, localId, themeVersion])

  if (renderError) {
    return (
      <div className={cn('notion-mermaid-block', className)}>
        <pre className="overflow-x-auto p-3 text-sm text-zinc-900 dark:text-zinc-100">
          <code>{code}</code>
        </pre>
        <p className="px-3 pb-3 text-xs text-red-600 dark:text-red-400">
          Mermaid render error: {renderError}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('notion-mermaid-block', className)}>
      <div ref={containerRef} className="notion-mermaid-svg" />
    </div>
  )
}
