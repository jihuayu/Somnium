import { nextTick, onBeforeUnmount, onMounted, ref, watch, type CSSProperties, type Ref } from 'vue'
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

function getHiddenStyle(config: FloatingHoverCardConfig): CSSProperties {
  return {
    position: 'fixed',
    left: `${config.initialOffset}px`,
    top: `${config.initialOffset}px`,
    visibility: 'hidden',
    ...(typeof config.targetWidth === 'number' ? { width: `${config.targetWidth}px` } : {})
  }
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
  const open = ref(false)
  const isClient = ref(false)
  const floatingStyle = ref<CSSProperties>(getHiddenStyle(config))
  let stopPosition: (() => void) | null = null
  let positionGeneration = 0

  function clearCloseTimer() {
    if (closeTimerRef.value === null) return
    window.clearTimeout(closeTimerRef.value)
    closeTimerRef.value = null
  }

  function stopFloatingPosition() {
    stopPosition?.()
    stopPosition = null
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

  watch(open, async (isOpen) => {
    stopFloatingPosition()
    const generation = ++positionGeneration

    if (!isOpen || !config.enabled) {
      floatingStyle.value = getHiddenStyle(config)
      return
    }

    await nextTick()
    if (generation !== positionGeneration || !triggerRef.value || !cardRef.value) return

    stopPosition = startFloatingHoverCardPosition(triggerRef.value, cardRef.value, {
      gap: config.gap,
      viewportPadding: config.viewportPadding,
      onPosition: ({ x, y }) => {
        if (generation !== positionGeneration) return
        const viewportWidth = window.innerWidth
        const width = typeof config.targetWidth === 'number'
          ? Math.min(
            config.targetWidth,
            Math.max(config.minWidth || config.targetWidth, viewportWidth - config.viewportPadding * 2)
          )
          : undefined
        floatingStyle.value = {
          position: 'fixed',
          left: `${x}px`,
          top: `${y}px`,
          visibility: 'visible',
          ...(typeof width === 'number' ? { width: `${width}px` } : {})
        }
      }
    })
  })

  onMounted(() => {
    isClient.value = true
  })

  onBeforeUnmount(() => {
    positionGeneration += 1
    clearCloseTimer()
    stopFloatingPosition()
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
