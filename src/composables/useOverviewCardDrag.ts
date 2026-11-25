import { nextTick, onBeforeUnmount } from 'vue'
import type { OverviewCardId } from '@/wallet/overviewLayout'

type Point = { x: number; y: number }
type CardDrag = {
  grid: HTMLElement
  card: HTMLElement
  id: OverviewCardId
  pointerId: number
  pointer: Point
  start: Point
  grab: Point
  lastReorder?: Point
  updating: boolean
}
type DragCallbacks = {
  preview: (card: OverviewCardId, target: OverviewCardId) => void
  finish: (card: OverviewCardId, commit: boolean) => void
}

const slotVariables = ['x', 'y', 'width', 'height'] as const
const shouldAnimate = () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches
const displayedCards = ({ grid, card }: CardDrag) =>
  Array.from(grid.children).filter(
    (child): child is HTMLElement =>
      child instanceof HTMLElement &&
      child !== card &&
      child.hasAttribute('data-card') &&
      child.style.display !== 'none',
  )

export function useOverviewCardDrag({ preview, finish: finishLayout }: DragCallbacks) {
  let drag: CardDrag | undefined
  let frame = 0
  const animations = new Map<HTMLElement, Animation>()

  function animate(card: HTMLElement, keyframes: Keyframe[]): void {
    animations.get(card)?.cancel()
    const motion = card.animate(keyframes, { duration: 180, easing: 'cubic-bezier(.2,.7,.25,1)' })
    animations.set(card, motion)
    motion.onfinish = () => {
      if (animations.get(card) === motion) animations.delete(card)
    }
  }

  function showSlot({ grid, card }: CardDrag): void {
    const values = [card.offsetLeft, card.offsetTop, card.offsetWidth, card.offsetHeight]
    slotVariables.forEach((name, index) => {
      grid.style.setProperty(`--overview-slot-${name}`, `${values[index]}px`)
    })
  }

  function placeDraggedCard({ grid, card, grab, pointer }: CardDrag): Point {
    const rect = grid.getBoundingClientRect()
    const local = { x: pointer.x - rect.left, y: pointer.y - rect.top }
    card.style.translate = `${local.x - grab.x - card.offsetLeft}px ${local.y - grab.y - card.offsetTop}px`
    return local
  }

  async function reorder(current: CardDrag): Promise<void> {
    const point = placeDraggedCard(current)
    if (current.updating) return
    const previous = current.lastReorder
    if (previous && Math.hypot(point.x - previous.x, point.y - previous.y) < 12) return

    // Use the grid's settled slots so a card sliding past the pointer cannot trigger another swap.
    const peers = displayedCards(current)
    const target = peers.find(
      (card) =>
        point.x >= card.offsetLeft &&
        point.x < card.offsetLeft + card.offsetWidth &&
        point.y >= card.offsetTop &&
        point.y < card.offsetTop + card.offsetHeight,
    )
    if (!target) return
    const before = shouldAnimate()
      ? peers.map((card) => ({ card, rect: card.getBoundingClientRect() }))
      : []
    current.lastReorder = point
    current.updating = true
    preview(current.id, target.dataset.card as OverviewCardId)
    await nextTick()
    current.updating = false
    if (drag !== current) return
    placeDraggedCard(current)
    showSlot(current)

    for (const { card, rect } of before) {
      animations.get(card)?.cancel()
      const settled = card.getBoundingClientRect()
      const x = rect.left - settled.left
      const y = rect.top - settled.top
      if (Math.hypot(x, y) < 1) continue
      animate(card, [{ transform: `translate(${x}px, ${y}px)` }, { transform: 'none' }])
    }
  }

  function tick(): void {
    if (!drag) return
    const { y } = drag.pointer
    const edge = 72
    const scroll =
      y < edge
        ? -Math.min(18, (edge - y) * 0.24)
        : y > window.innerHeight - edge
          ? Math.min(18, (y - window.innerHeight + edge) * 0.24)
          : 0
    if (scroll) window.scrollBy({ top: scroll, behavior: 'instant' })
    void reorder(drag)
    frame = requestAnimationFrame(tick)
  }

  function start(event: PointerEvent): void {
    if (drag || !event.isPrimary || event.button !== 0) return
    const grid = event.currentTarget as HTMLElement
    const target = event.target as Element
    const card = target.closest<HTMLElement>('[data-card]')
    const grip = target.closest('[data-overview-grip]')
    if (!card || card.parentElement !== grid || (target.closest('button') && !grip)) return
    if (event.pointerType === 'touch' && !grip) return
    animations.get(card)?.cancel()
    const start = { x: event.clientX, y: event.clientY }
    const rect = grid.getBoundingClientRect()
    drag = {
      grid,
      card,
      id: card.dataset.card as OverviewCardId,
      pointerId: event.pointerId,
      pointer: start,
      start,
      grab: { x: start.x - rect.left - card.offsetLeft, y: start.y - rect.top - card.offsetTop },
      updating: false,
    }
    grid.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent): void {
    if (drag?.pointerId !== event.pointerId) return
    drag.pointer = { x: event.clientX, y: event.clientY }
    if (frame || Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < 6) return
    drag.card.setAttribute('data-overview-dragging', '')
    drag.grid.setAttribute('data-overview-sorting', '')
    showSlot(drag)
    tick()
  }

  function stop(current: CardDrag): void {
    drag = undefined
    cancelAnimationFrame(frame)
    frame = 0
    const { grid, pointerId } = current
    grid.removeAttribute('data-overview-sorting')
    slotVariables.forEach((name) => grid.style.removeProperty(`--overview-slot-${name}`))
    if (grid.hasPointerCapture(pointerId)) grid.releasePointerCapture(pointerId)
  }

  function resetCard(card: HTMLElement): void {
    card.removeAttribute('data-overview-dragging')
    card.style.removeProperty('translate')
  }

  function cancel(): void {
    for (const animation of animations.values()) animation.cancel()
    animations.clear()
    if (!drag) return
    const current = drag
    stop(current)
    resetCard(current.card)
    finishLayout(current.id, false)
  }

  async function finish(event: PointerEvent): Promise<void> {
    if (drag?.pointerId !== event.pointerId) return
    const current = drag
    const moved = !!frame
    if (moved) {
      current.pointer = { x: event.clientX, y: event.clientY }
      void reorder(current)
    }
    stop(current)
    finishLayout(current.id, true)
    await nextTick()
    if (moved && shouldAnimate()) {
      placeDraggedCard(current)
      animate(current.card, [{ translate: current.card.style.translate }, { translate: '0px 0px' }])
    }
    resetCard(current.card)
  }

  function interrupt(event: PointerEvent): void {
    if (drag?.pointerId === event.pointerId) cancel()
  }

  onBeforeUnmount(cancel)
  return { start, move, finish, interrupt, cancel }
}
