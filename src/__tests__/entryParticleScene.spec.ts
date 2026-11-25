/* oxlint-disable vitest/no-conditional-expect -- Shared cases explicitly test worker and local geometry delivery. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildShape,
  createParticleScene,
  type EntryShape,
  type Particle,
} from '@/graphics/entryParticles'

// Fixed, visible particle identities let us compare the same dot across consecutive frames.
vi.mock('@/graphics/entryShapeGeometry', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/graphics/entryShapeGeometry')>()
  const positions = { brand: 0, wallet: -90, key: 85, import: 40, create: -40, organization: 55, shield: -55 }
  const fixture = (shape: EntryShape): Particle[] =>
    Array.from({ length: 12 }, (_, i) => ({
      x: positions[shape] + i,
      y: i * 2,
      z: 1,
      radius: 1,
      alpha: 1,
      group: 0,
    }))
  return {
    ...original,
    buildShape: fixture,
    *buildShapeRows(shape: EntryShape) {
      yield
      return fixture(shape)
    },
  }
})

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
        postMessage = vi.fn<(...args: unknown[]) => unknown>()
        terminate = vi.fn<(...args: unknown[]) => unknown>()
        constructor() {
          // Capture the worker instance so the test can deliver asynchronous replies.
          // oxlint-disable-next-line typescript/no-this-alias
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
      const anchor = document.createElement('div')
      const canvas = document.createElement('canvas')
      anchor.append(canvas)
      vi.spyOn(anchor, 'getBoundingClientRect').mockReturnValue({
        left: 500,
        top: 100,
        width: 500,
        height: 500,
        right: 1000,
        bottom: 600,
      } as DOMRect)
      vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
        left: 0,
        top: 0,
        width: 1200,
        height: 800,
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
        window.dispatchEvent(
          Object.assign(new Event('pointermove'), { clientX: 410, clientY: 145 }),
        )
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
        for (let time = 4040; time <= 5320; time += 40) callback(time)
        const preceding = dots
        callback(5360)
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
        callback(5368)
        // A rapid second click preserves the current direction and speed on its first frame.
        const prior = interrupted[0]![0]! - preceding[0]![0]!
        const after = dots[0]![0]! - interrupted[0]![0]!
        expect(Math.abs(prior)).toBeGreaterThan(1)
        expect(after / 0.008 / (prior / 0.04)).toBeCloseTo(1, 1)

        scene.setShape('brand')
        worker?.deliver('brand')
        callback(5368)
        for (let frame = 1; frame <= 65; frame++) {
          callback(5368 + frame * 40)
          if (frame === 25) expect(Number(canvas.dataset.progress)).toBeCloseTo(1 / 2.6, 2)
        }
        expect(canvas.dataset.progress).toBe('1.00')
      } finally {
        scene.destroy()
        if (worker) expect(worker.terminate).toHaveBeenCalledOnce()
      }
    },
  )
})
