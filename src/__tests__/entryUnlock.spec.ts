import { describe, it, expect, vi, afterEach } from 'vitest'
import { unlockParticle } from '@/graphics/entryParticles'
import { unlockPhase, revealUnlockedPage } from '@/composables/useEntryUnlock'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  unlockPhase.value = 'idle'
})
describe('unlock dispersion', () => {
  const p = { x: 42, y: -20, z: 5, radius: 1, alpha: 0.8, group: 1 }
  it('loses the source silhouette and keeps expanding instead of rotating a fixed cloud', () => {
    const origin = { ...p, x: 0, y: 0, z: 0 }
    const early = unlockParticle(origin, 3, 1, 0, 41)
    const later = unlockParticle(origin, 6, 1, 0, 41)
    expect(Math.hypot(later.x, later.y)).toBeGreaterThan(Math.hypot(early.x, early.y) * 1.5)
    const fromShape = unlockParticle(p, 3, 1, 0, 41)
    expect(Math.hypot(fromShape.x - early.x, fromShape.y - early.y)).toBeLessThan(0.001)
    // The same point continues roughly outward, rather than orbiting around the center.
    const dot =
      (early.x * later.x + early.y * later.y) /
      (Math.hypot(early.x, early.y) * Math.hypot(later.x, later.y))
    expect(dot).toBeGreaterThan(0.98)
  })
  it('starts from the live particle, stays visible while loading and vanishes at reveal completion', () => {
    expect(unlockParticle(p, 0, 0, 0, 4)).toEqual(p)
    const waiting = unlockParticle(p, 2, 1, 0, 4)
    expect(waiting.alpha).toBe(p.alpha)
    expect(waiting.x).not.toBe(p.x)
    expect(unlockParticle(p, 3, 1, 1, 4).alpha).toBe(0)
    expect(unlockParticle(p, 3, 1, 0.5, 4, true).x).toBe(p.x)
  })
  it('waits for navigation before revealing and always cleans up after failure', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16),
    )
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let ready!: () => void
    const navigation = new Promise<void>((resolve) => {
      ready = resolve
    })
    const done = revealUnlockedPage(() => navigation)
    await vi.advanceTimersByTimeAsync(500)
    expect(unlockPhase.value).toBe('arriving')
    ready()
    await vi.advanceTimersByTimeAsync(40)
    expect(unlockPhase.value).toBe('revealing')
    await vi.advanceTimersByTimeAsync(1100)
    await done
    expect(unlockPhase.value).toBe('idle')
    await expect(revealUnlockedPage(() => Promise.reject(new Error('failed')))).rejects.toThrow(
      'failed',
    )
    expect(unlockPhase.value).toBe('idle')
  })
})
