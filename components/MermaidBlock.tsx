'use client'

import { useEffect, useId, useRef, useState } from 'react'
import cn from 'classnames'
import mermaid from 'mermaid'

interface MermaidBlockProps {
  code: string
  className?: string
}

function isDarkMode(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export default function MermaidBlock({ code, className }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
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

    async function renderDiagram() {
      if (!containerRef.current) return

      const source = `${code || ''}`.trim()
      if (!source) {
        containerRef.current.innerHTML = ''
        setRenderError('')
        return
      }

      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: isDarkMode() ? 'dark' : 'default'
        })

        const { svg } = await mermaid.render(`mermaid-${localId}-${themeVersion}`, source)
        if (cancelled || !containerRef.current) return

        containerRef.current.innerHTML = svg
        setRenderError('')
      } catch (error) {
        if (cancelled) return

        if (containerRef.current) {
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
