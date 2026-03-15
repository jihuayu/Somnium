import { ref, onMounted, onBeforeUnmount, watch, type Ref } from 'vue'
import type { CSSProperties } from 'vue'

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

export interface FloatingHoverCardReturn<TriggerEl extends HTMLElement, CardEl extends HTMLElement> {
  triggerRef: Ref<TriggerEl | null>
  cardRef: Ref<CardEl | null>
  open: Ref<boolean>
  isClient: Ref<boolean>
  floatingStyle: Ref<CSSProperties>
  openCard: () => void
  scheduleClose: () => void
  handleBlur: (event: FocusEvent) => void
}

export function useFloatingHoverCard<TriggerEl extends HTMLElement, CardEl extends HTMLElement>(
  config: FloatingHoverCardConfig
): FloatingHoverCardReturn<TriggerEl, CardEl> {
  const triggerRef = ref<TriggerEl | null>(null) as Ref<TriggerEl | null>
  const cardRef = ref<CardEl | null>(null) as Ref<CardEl | null>
  const closeTimerRef = ref<number | null>(null)
  const updateRafRef = ref<number | null>(null)
  const cardSizeRef = { width: config.fallbackWidth, height: config.fallbackHeight }
  const open = ref(false)
  const isClient = ref(false)
  const floatingStyle = ref<CSSProperties>({
    position: 'fixed',
    left: `${config.initialOffset}px`,
    top: `${config.initialOffset}px`,
    visibility: 'hidden',
    ...(typeof config.targetWidth === 'number' ? { width: `${config.targetWidth}px` } : {})
  })

  function clearCloseTimer() {
    if (closeTimerRef.value === null) return
    window.clearTimeout(closeTimerRef.value)
    closeTimerRef.value = null
  }

  function clearUpdateRaf() {
    if (updateRafRef.value === null) return
    window.cancelAnimationFrame(updateRafRef.value)
    updateRafRef.value = null
  }

  function openCard() {
    if (!config.enabled) return
    clearCloseTimer()
    open.value = true
  }

  function scheduleClose() {
    clearCloseTimer()
    closeTimerRef.value = window.setTimeout(() => { open.value = false }, config.closeDelayMs)
  }

  function updatePosition() {
    if (!open.value || !config.enabled || !triggerRef.value || !cardRef.value) return

    const triggerRect = triggerRef.value.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const viewportPadding = config.viewportPadding
    const gap = config.gap
    const width = typeof config.targetWidth === 'number'
      ? Math.min(config.targetWidth, Math.max(config.minWidth || config.targetWidth, viewportWidth - viewportPadding * 2))
      : cardSizeRef.width || config.fallbackWidth
    const height = cardSizeRef.height || config.fallbackHeight

    const canPlaceBottom = triggerRect.bottom + gap + height + viewportPadding <= viewportHeight
    const canPlaceTop = triggerRect.top - gap - height >= viewportPadding
    const placeTop = !canPlaceBottom && canPlaceTop

    const left = clamp(triggerRect.left, viewportPadding, viewportWidth - width - viewportPadding)
    const top = clamp(
      placeTop ? triggerRect.top - gap - height : triggerRect.bottom + gap,
      viewportPadding,
      viewportHeight - height - viewportPadding
    )

    floatingStyle.value = {
      position: 'fixed',
      left: `${Number.isFinite(left) ? left : viewportPadding}px`,
      top: `${Number.isFinite(top) ? top : viewportPadding}px`,
      visibility: 'visible',
      ...(typeof config.targetWidth === 'number' ? { width: `${width}px` } : {})
    }
  }

  function scheduleUpdatePosition() {
    clearUpdateRaf()
    updateRafRef.value = window.requestAnimationFrame(() => {
      updateRafRef.value = null
      updatePosition()
    })
  }

  let resizeObserver: ResizeObserver | null = null
  let removeListeners: (() => void) | null = null

  watch(open, (isOpen) => {
    if (removeListeners) {
      removeListeners()
      removeListeners = null
    }
    resizeObserver?.disconnect()
    resizeObserver = null

    if (!isOpen || !config.enabled) return

    scheduleUpdatePosition()

    const handleViewportChange = () => scheduleUpdatePosition()

    resizeObserver = cardRef.value
      ? new ResizeObserver((entries) => {
          const entry = entries[0]
          const rect = entry?.contentRect || cardRef.value?.getBoundingClientRect()
          cardSizeRef.width = Math.ceil(rect?.width || config.fallbackWidth)
          cardSizeRef.height = Math.ceil(rect?.height || config.fallbackHeight)
          scheduleUpdatePosition()
        })
      : null

    if (cardRef.value && resizeObserver) resizeObserver.observe(cardRef.value)

    window.addEventListener('resize', handleViewportChange)
    window.addEventListener('scroll', handleViewportChange, { capture: true, passive: true })

    removeListeners = () => {
      clearUpdateRaf()
      window.removeEventListener('resize', handleViewportChange)
      window.removeEventListener('scroll', handleViewportChange, true)
    }
  })

  onMounted(() => {
    isClient.value = true
  })

  onBeforeUnmount(() => {
    clearCloseTimer()
    clearUpdateRaf()
    removeListeners?.()
    removeListeners = null
    resizeObserver?.disconnect()
    resizeObserver = null
  })

  function handleBlur(event: FocusEvent) {
    const nextTarget = (event as FocusEvent & { relatedTarget: Node | null }).relatedTarget
    if (nextTarget && (triggerRef.value?.contains(nextTarget) || cardRef.value?.contains(nextTarget))) return
    scheduleClose()
  }

  return {
    triggerRef,
    cardRef,
    open,
    isClient,
    floatingStyle,
    openCard,
    scheduleClose,
    handleBlur
  }
}
