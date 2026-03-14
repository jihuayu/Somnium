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

export function useFloatingHoverCard<TriggerEl extends HTMLElement, CardEl extends HTMLElement>(
  config: FloatingHoverCardConfig
) {
  const triggerRef = useRef<TriggerEl | null>(null)
  const cardRef = useRef<CardEl | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const updateRafRef = useRef<number | null>(null)
  const cardSizeRef = useRef({ width: config.fallbackWidth, height: config.fallbackHeight })
  const [open, setOpen] = useState(false)
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties>(() => ({
    position: 'fixed',
    left: config.initialOffset,
    top: config.initialOffset,
    visibility: 'hidden',
    ...(typeof config.targetWidth === 'number' ? { width: config.targetWidth } : {})
  }))

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
    closeTimerRef.current = window.setTimeout(() => setOpen(false), config.closeDelayMs)
  }, [clearCloseTimer, config.closeDelayMs])

  const updatePosition = useCallback(() => {
    if (!open || !config.enabled || !triggerRef.current || !cardRef.current) return

    const triggerRect = triggerRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const viewportPadding = config.viewportPadding
    const gap = config.gap
    const width = typeof config.targetWidth === 'number'
      ? Math.min(config.targetWidth, Math.max(config.minWidth || config.targetWidth, viewportWidth - viewportPadding * 2))
      : cardSizeRef.current.width || config.fallbackWidth
    const height = cardSizeRef.current.height || config.fallbackHeight

    const canPlaceBottom = triggerRect.bottom + gap + height + viewportPadding <= viewportHeight
    const canPlaceTop = triggerRect.top - gap - height >= viewportPadding
    const placeTop = !canPlaceBottom && canPlaceTop

    const left = clamp(triggerRect.left, viewportPadding, viewportWidth - width - viewportPadding)
    const top = clamp(
      placeTop ? triggerRect.top - gap - height : triggerRect.bottom + gap,
      viewportPadding,
      viewportHeight - height - viewportPadding
    )

    setFloatingStyle({
      position: 'fixed',
      left: Number.isFinite(left) ? left : viewportPadding,
      top: Number.isFinite(top) ? top : viewportPadding,
      visibility: 'visible',
      ...(typeof config.targetWidth === 'number' ? { width } : {})
    })
  }, [config, open])

  const scheduleUpdatePosition = useCallback(() => {
    clearUpdateRaf()
    updateRafRef.current = window.requestAnimationFrame(() => {
      updateRafRef.current = null
      updatePosition()
    })
  }, [clearUpdateRaf, updatePosition])

  useEffect(() => {
    if (!open || !config.enabled) return undefined

    scheduleUpdatePosition()
    const handleViewportChange = () => scheduleUpdatePosition()
    const observer = cardRef.current
      ? new ResizeObserver(entries => {
          const entry = entries[0]
          const rect = entry?.contentRect || cardRef.current?.getBoundingClientRect()
          cardSizeRef.current = {
            width: Math.ceil(rect?.width || config.fallbackWidth),
            height: Math.ceil(rect?.height || config.fallbackHeight)
          }
          scheduleUpdatePosition()
        })
      : null

    if (cardRef.current && observer) {
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
  }, [clearUpdateRaf, config, open, scheduleUpdatePosition])

  useEffect(() => () => {
    clearCloseTimer()
    clearUpdateRaf()
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
