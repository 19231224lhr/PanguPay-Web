import type { ObjectDirective } from 'vue'

// Keep native details/summary semantics. Height is measured only on activation;
// reversals start at the current painted height rather than restarting the motion.
const cleanup = new WeakMap<HTMLDetailsElement, () => void>()
export const smoothDetails: ObjectDirective<HTMLDetailsElement> = {
  mounted(element) {
    const summary = element.querySelector('summary')
    if (!summary) return
    let animation: Animation | undefined
    let desired = element.open
    const reset = () => {
      element.style.height = ''
      element.style.overflow = ''
    }
    const toggle = () => {
      if (!animation) desired = element.open
    }
    const click = (event: MouseEvent) => {
      event.preventDefault()
      desired = animation ? !desired : !element.open
      const from = element.getBoundingClientRect().height
      animation?.cancel()
      animation = undefined
      reset()
      if (
        event.detail === 0 ||
        !element.animate ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      ) {
        element.open = desired
        return
      }
      element.open = desired
      const to = element.getBoundingClientRect().height
      element.open = true
      element.style.height = `${from}px`
      element.style.overflow = 'hidden'
      const current = element.animate([{ height: `${from}px` }, { height: `${to}px` }], {
        duration: 190,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      })
      animation = current
      current.onfinish = () => {
        if (animation !== current) return
        element.open = desired
        current.cancel()
        animation = undefined
        reset()
      }
    }
    summary.addEventListener('click', click)
    element.addEventListener('toggle', toggle)
    cleanup.set(element, () => {
      animation?.cancel()
      reset()
      summary.removeEventListener('click', click)
      element.removeEventListener('toggle', toggle)
    })
  },
  beforeUnmount(element) {
    cleanup.get(element)?.()
    cleanup.delete(element)
  },
}
