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
  it('settles into a drifting cloud without growing during a long wait', () => {
    const origin = { ...p, x: 0, y: 0, z: 0 }
    const cloud = (time: number) =>
      Array.from({ length: 500 }, (_, i) => unlockParticle(p, time, 1, 0, i))
    const extent = (points: ReturnType<typeof cloud>) =>
      Math.sqrt(points.reduce((sum, q) => sum + q.x * q.x + q.y * q.y, 0) / points.length)
    const early = cloud(10),
      later = cloud(60)
    expect(extent(later) / extent(early)).toBeGreaterThan(0.85)
    expect(extent(later) / extent(early)).toBeLessThan(1.15)
    expect(
      later.filter((q, i) => Math.hypot(q.x - early[i]!.x, q.y - early[i]!.y) > 3).length,
    ).toBeGreaterThan(400)
    const fromShape = unlockParticle(p, 4, 1, 0, 41)
    const fromOrigin = unlockParticle(origin, 4, 1, 0, 41)
    expect(Math.hypot(fromShape.x - fromOrigin.x, fromShape.y - fromOrigin.y)).toBeLessThan(0.001)
    const released = unlockParticle(p, 10, 1, 0.5, 41)
    const waiting = unlockParticle(p, 10, 1, 0, 41)
    expect(released.x).toBe(waiting.x)
    expect(released.y).toBe(waiting.y)
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
