'use client'

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent } from 'react'
import { startFloatingHoverCardPosition } from './floatingHoverCardPosition'

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

function getHiddenStyle(initialOffset: number, targetWidth?: number): CSSProperties {
  return {
    position: 'fixed',
    left: initialOffset,
    top: initialOffset,
    visibility: 'hidden',
    ...(typeof targetWidth === 'number' ? { width: targetWidth } : {})
  }
}

export function useFloatingHoverCard<TriggerEl extends HTMLElement, CardEl extends HTMLElement>(
  config: FloatingHoverCardConfig
) {
  const enabled = config.enabled
  const closeDelayMs = config.closeDelayMs
  const viewportPadding = config.viewportPadding
  const gap = config.gap
  const initialOffset = config.initialOffset
  const targetWidth = config.targetWidth
  const minWidth = config.minWidth

  const triggerRef = useRef<TriggerEl | null>(null)
  const cardRef = useRef<CardEl | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ x: number, y: number, width?: number } | null>(null)

  const floatingStyle: CSSProperties = open && coords
    ? {
        position: 'fixed',
        left: coords.x,
        top: coords.y,
        visibility: 'visible',
        ...(typeof coords.width === 'number' ? { width: coords.width } : {})
      }
    : getHiddenStyle(initialOffset, targetWidth)

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current === null) return
    window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = null
  }, [])

  const openCard = useCallback(() => {
    if (!enabled) return
    clearCloseTimer()
    setOpen(isOpen => {
      if (!isOpen) setCoords(null)
      return true
    })
  }, [clearCloseTimer, enabled])

  const scheduleClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = window.setTimeout(() => setOpen(false), closeDelayMs)
  }, [clearCloseTimer, closeDelayMs])

  useLayoutEffect(() => {
    if (!open || !enabled || !triggerRef.current || !cardRef.current) return undefined

    return startFloatingHoverCardPosition(triggerRef.current, cardRef.current, {
      gap,
      viewportPadding,
      onPosition: ({ x, y }) => {
        const width = typeof targetWidth === 'number'
          ? Math.min(
            targetWidth,
            Math.max(minWidth || targetWidth, window.innerWidth - viewportPadding * 2)
          )
          : undefined
        setCoords({ x, y, width })
      }
    })
  }, [enabled, gap, minWidth, open, targetWidth, viewportPadding])

  useLayoutEffect(() => () => {
    clearCloseTimer()
  }, [clearCloseTimer])

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
