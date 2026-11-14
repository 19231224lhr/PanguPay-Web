import { describe, it, expect } from 'vitest'
import { buildShape, morphParticle, type EntryShape } from '@/graphics/entryParticles'

describe('entry particle geometry', () => {
  it('has finite, equally sized targets with highlight and solid-shadow dots', () => {
    const counts = new Set<number>()
    for (const shape of ['wallet', 'key', 'create', 'import', 'shield'] as EntryShape[]) {
      const points = buildShape(shape)
      counts.add(points.length)
      const visible = points.filter((p) => p.alpha > 0)
      expect(visible.length).toBeGreaterThan(700)
      expect(visible.every((p) => Object.values(p).every(Number.isFinite))).toBe(true)
      expect(Math.min(...visible.map((p) => p.radius))).toBeLessThan(0.55)
      expect(Math.max(...visible.map((p) => p.radius))).toBeGreaterThan(0.95)
    }
    expect(counts.size).toBe(1)
  })
  it('retargets a partially dispersed particle without a position or opacity discontinuity', () => {
    const a = buildShape('wallet')[200]!,
      b = buildShape('key')[200]!,
      c = buildShape('import')[200]!
    const middle = morphParticle(a, b, 0.45, 200)
    expect(morphParticle(middle, c, 0, 200)).toEqual(middle)
    const final = morphParticle(middle, c, 1, 200)
    for (const field of ['x', 'y', 'z', 'radius', 'alpha'] as const)
      expect(final[field]).toBeCloseTo(c[field], 8)
  })
})
