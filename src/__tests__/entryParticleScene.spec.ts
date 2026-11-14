import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildShape,
  createParticleScene,
  type EntryShape,
  type Particle,
} from '@/graphics/entryParticles'

afterEach(() => vi.unstubAllGlobals())

describe('entry particle scene continuity', () => {
  it.each([false, true])(
    'keeps rendered float and tilt through retargets (background generation: %s)',
    async (background) => {
      let callback: FrameRequestCallback = () => {}
      let dots: number[][] = []
      let worker: BackgroundShapes | undefined
      class BackgroundShapes {
        onmessage?: (event: { data: { shape: EntryShape; points: Particle[] } }) => void
        postMessage = vi.fn()
        terminate = vi.fn()
        constructor() {
          worker = this
        }
        deliver(shape: EntryShape) {
          this.onmessage?.({ data: { shape, points: buildShape(shape) } })
        }
      }
      vi.stubGlobal('Worker', background ? BackgroundShapes : undefined)
      vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
        callback = fn
        return 1
      })
      vi.stubGlobal('cancelAnimationFrame', () => {})
      vi.stubGlobal('matchMedia', () => ({ matches: false }))
      vi.stubGlobal(
        'ResizeObserver',
        class {
          observe() {}
          disconnect() {}
        },
      )
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          observe() {}
          disconnect() {}
        },
      )
      const canvas = document.createElement('canvas')
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 500,
        height: 500,
      } as DOMRect)
      vi.spyOn(canvas, 'getContext').mockReturnValue({
        setTransform() {},
        clearRect() {
          dots = []
        },
        beginPath() {},
        fill() {},
        fillRect() {},
        arc(x: number, y: number, radius: number) {
          dots.push([x, y, radius])
        },
      } as unknown as CanvasRenderingContext2D)
      const scene = createParticleScene(canvas, 'wallet')
      try {
        canvas.dispatchEvent(Object.assign(new Event('pointermove'), { clientX: 410, clientY: 145 }))
        for (let time = 0; time <= 4000; time += 40) callback(time)
        const settled = dots
        scene.setShape('key')
        await Promise.resolve()
        if (background) {
          expect(worker).toBeDefined()
          callback(4000)
          expect(canvas.dataset.progress).toBe('1.00')
          // A late response for an abandoned route must not retarget the live scene.
          scene.setShape('import')
          worker!.deliver('key')
          callback(4000)
          expect(canvas.dataset.progress).toBe('1.00')
          worker!.deliver('import')
        }
        callback(4000)
        expect(dots.length).toBe(settled.length)
        expect(
          Math.max(
            ...dots.map((dot, i) =>
              Math.hypot(dot[0]! - settled[i]![0]!, dot[1]! - settled[i]![1]!),
            ),
          ),
        ).toBeLessThan(0.0001)
        for (let time = 4040; time <= 5360; time += 40) callback(time)
        const interrupted = dots
        scene.setShape('wallet')
        await Promise.resolve()
        callback(5360)
        expect(dots.length).toBe(interrupted.length)
        expect(
          Math.max(
            ...dots.map((dot, i) =>
              Math.hypot(dot[0]! - interrupted[i]![0]!, dot[1]! - interrupted[i]![1]!),
            ),
          ),
        ).toBeLessThan(0.0001)
      } finally {
        scene.destroy()
        if (worker) expect(worker.terminate).toHaveBeenCalledOnce()
      }
    },
  )
})
