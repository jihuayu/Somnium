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
  const hostRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const renderTokenRef = useRef(0)
  const [renderError, setRenderError] = useState('')
  const [themeVersion, setThemeVersion] = useState(0)
  const [shouldRender, setShouldRender] = useState(false)
  const localId = useId().replaceAll(':', '_')

  useEffect(() => {
    if (shouldRender) return
    if (!hostRef.current) return

    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let idleId: number | null = null
    const activate = () => setShouldRender(true)

    const scheduleActivate = () => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleId = (window as any).requestIdleCallback(activate, { timeout: 1200 })
      } else {
        idleTimer = globalThis.setTimeout(activate, 160)
      }
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      scheduleActivate()
    }, {
      root: null,
      rootMargin: '240px 0px',
      threshold: 0.01
    })
    observer.observe(hostRef.current)

    return () => {
      observer.disconnect()
      if (idleId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleId)
      }
      if (idleTimer !== null) {
        globalThis.clearTimeout(idleTimer)
      }
    }
  }, [shouldRender])

  useEffect(() => {
    if (!shouldRender) return
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
  }, [shouldRender])

  useEffect(() => {
    if (!shouldRender) return
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
        if (error instanceof DOMException && error.name === 'NoModificationAllowedError') return

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
  }, [code, localId, shouldRender, themeVersion])

  if (renderError) {
    return (
      <div ref={hostRef} className={cn('notion-mermaid-block', className)}>
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
    <div ref={hostRef} className={cn('notion-mermaid-block', className)}>
      {shouldRender ? (
        <div ref={containerRef} className="notion-mermaid-svg" />
      ) : (
        <pre className="overflow-x-auto p-3 text-sm text-zinc-500 dark:text-zinc-400">
          <code>Mermaid diagram deferred</code>
        </pre>
      )}
    </div>
  )
}
