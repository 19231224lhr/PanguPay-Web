import { describe, it, expect } from 'vitest'
import { buildShape, morphParticle } from '@/graphics/entryParticles'
import { entryShapes } from '@/graphics/entryShapeGeometry'

describe('entry particle geometry', () => {
  it('has finite, equally sized targets with highlight and solid-shadow dots', () => {
    const counts = new Set<number>()
    for (const shape of entryShapes) {
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
  it('starts traveling immediately when a new shape is selected from rest', () => {
    const a = { x: 0, y: 0, z: 0, radius: 1, alpha: 1, group: 0 }
    const b = { ...a, x: 160 }
    for (const index of [0, 9, 18]) {
      expect(morphParticle(a, b, 0.016 / 2.6, index).x).toBeGreaterThan(1)
    }
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
