import { autoUpdate, computePosition, flip, inline, offset, shift } from '@floating-ui/dom'

/**
 * EN: Floating UI recipe from the official tutorial: center on the trigger, then flip/shift if it does not fit.
 * ZH: 按 Floating UI 官方教程：相对触发点居中弹出，放不下时 flip/shift 自适应。
 * @see https://floating-ui.com/docs/tutorial
 */
export function getFloatingHoverCardComputeOptions(gap: number, viewportPadding: number) {
  return {
    placement: 'top' as const,
    strategy: 'fixed' as const,
    middleware: [
      inline(),
      offset(gap),
      flip({
        padding: viewportPadding,
        fallbackPlacements: ['bottom', 'right', 'left']
      }),
      shift({ padding: viewportPadding })
    ]
  }
}

export function startFloatingHoverCardPosition(
  trigger: Element,
  card: HTMLElement,
  options: {
    gap: number
    viewportPadding: number
    onPosition: (coords: { x: number, y: number }) => void
  }
) {
  return autoUpdate(trigger, card, () => {
    void computePosition(trigger, card, getFloatingHoverCardComputeOptions(options.gap, options.viewportPadding)).then(({ x, y }) => {
      options.onPosition({ x, y })
    })
  })
}
