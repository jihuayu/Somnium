'use client'

import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react'

interface FloatingHoverCardConfig {
  enabled: boolean
  closeDelayMs: number
  viewportPadding: number
  gap: number
  initialOffset: number
  fallbackWidth: number
  fallbackHeight: number
  targetWidth?: number
  minWidth?: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function useFloatingHoverCard<
  TriggerEl extends HTMLElement,
  CardEl extends HTMLElement
>(config: FloatingHoverCardConfig) {
  const triggerRef = useRef<TriggerEl | null>(null)
  const cardRef = useRef<CardEl | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const updateRafRef = useRef<number | null>(null)
  const cardSizeRef = useRef<{ width: number, height: number }>({
    width: config.fallbackWidth,
    height: config.fallbackHeight
  })
  const [open, setOpen] = useState(false)
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>(() => {
    const base: CSSProperties = {
      position: 'fixed',
      left: config.initialOffset,
      top: config.initialOffset,
      visibility: 'hidden'
    }
    if (typeof config.targetWidth === 'number') {
      base.width = config.targetWidth
    }
    return base
  })

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const clearUpdateRaf = useCallback(() => {
    if (updateRafRef.current === null) return
    window.cancelAnimationFrame(updateRafRef.current)
    updateRafRef.current = null
  }, [])

  const openCard = useCallback(() => {
    if (!config.enabled) return
    clearCloseTimer()
    setOpen(true)
  }, [clearCloseTimer, config.enabled])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false)
    }, config.closeDelayMs)
  }, [clearCloseTimer, config.closeDelayMs])

  const updatePosition = useCallback(() => {
    if (!open || !config.enabled || !triggerRef.current || !cardRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const cardSize = cardSizeRef.current
    const viewportPadding = config.viewportPadding
    const gap = config.gap

    const width = typeof config.targetWidth === 'number'
      ? Math.min(
          config.targetWidth,
          Math.max(config.minWidth || config.targetWidth, viewportWidth - viewportPadding * 2)
        )
      : (cardSize.width || config.fallbackWidth)
    const height = cardSize.height || config.fallbackHeight

    const canPlaceBottom = triggerRect.bottom + gap + height + viewportPadding <= viewportHeight
    const canPlaceTop = triggerRect.top - gap - height >= viewportPadding
    const placeTop = !canPlaceBottom && canPlaceTop

    let left = clamp(triggerRect.left, viewportPadding, viewportWidth - width - viewportPadding)
    if (!Number.isFinite(left)) left = viewportPadding

    let top = placeTop ? triggerRect.top - gap - height : triggerRect.bottom + gap
    top = clamp(top, viewportPadding, viewportHeight - height - viewportPadding)
    if (!Number.isFinite(top)) top = viewportPadding

    setFloatingStyle(prev => {
      const unchanged =
        prev.position === 'fixed' &&
        prev.left === left &&
        prev.top === top &&
        prev.width === (typeof config.targetWidth === 'number' ? width : prev.width) &&
        prev.visibility === 'visible'
      if (unchanged) return prev
      return {
        position: 'fixed',
        left,
        top,
        ...(typeof config.targetWidth === 'number' ? { width } : {}),
        visibility: 'visible'
      }
    })
  }, [
    config.enabled,
    config.fallbackHeight,
    config.fallbackWidth,
    config.gap,
    config.minWidth,
    config.targetWidth,
    config.viewportPadding,
    open
  ])

  const scheduleUpdatePosition = useCallback(() => {
    clearUpdateRaf()
    updateRafRef.current = window.requestAnimationFrame(() => {
      updateRafRef.current = null
      updatePosition()
    })
  }, [clearUpdateRaf, updatePosition])

  useEffect(() => {
    if (!open || !config.enabled) return

    scheduleUpdatePosition()
    const handleViewportChange = () => scheduleUpdatePosition()
    const observer = cardRef.current
      ? new ResizeObserver(entries => {
          const entry = entries[0]
          if (entry?.contentRect) {
            cardSizeRef.current = {
              width: Math.ceil(entry.contentRect.width) || config.fallbackWidth,
              height: Math.ceil(entry.contentRect.height) || config.fallbackHeight
            }
          } else if (cardRef.current) {
            const rect = cardRef.current.getBoundingClientRect()
            cardSizeRef.current = {
              width: Math.ceil(rect.width) || config.fallbackWidth,
              height: Math.ceil(rect.height) || config.fallbackHeight
            }
          }
          scheduleUpdatePosition()
        })
      : null

    if (cardRef.current && observer) {
      const rect = cardRef.current.getBoundingClientRect()
      cardSizeRef.current = {
        width: Math.ceil(rect.width) || config.fallbackWidth,
        height: Math.ceil(rect.height) || config.fallbackHeight
      }
      observer.observe(cardRef.current)
    }

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true })

    return () => {
      clearUpdateRaf()
      observer?.disconnect()
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  }, [
    clearUpdateRaf,
    config.enabled,
    config.fallbackHeight,
    config.fallbackWidth,
    open,
    scheduleUpdatePosition
  ])

  useEffect(() => {
    return () => {
      clearCloseTimer()
      clearUpdateRaf()
    }
  }, [clearCloseTimer, clearUpdateRaf])

  const handleBlur = useCallback((event: FocusEvent<TriggerEl | CardEl>) => {
    const nextTarget = event.relatedTarget as Node | null
    if (nextTarget && (triggerRef.current?.contains(nextTarget) || cardRef.current?.contains(nextTarget))) return
    scheduleClose()
  }, [scheduleClose])

  return {
    triggerRef,
    cardRef,
    open,
    floatingStyle,
    openCard,
    scheduleClose,
    handleBlur
  }
}
