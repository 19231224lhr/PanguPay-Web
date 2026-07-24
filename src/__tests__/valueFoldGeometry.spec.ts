import { describe, expect, it } from 'vitest'

import {
  FIELD_CENTER,
  GRID_POSITIONS,
  buildFoldPath,
  foldCoordinate,
  lineAppearance,
  lineBreath,
} from '@/components/valueFoldGeometry'

describe('value fold geometry', () => {
  it('keeps every breathing line mirrored around the field center', () => {
    for (let index = 0; index < Math.floor(GRID_POSITIONS.length / 2); index += 1) {
      const left = GRID_POSITIONS[index]!
      const right = GRID_POSITIONS[GRID_POSITIONS.length - 1 - index]!

      const foldedLeft = foldCoordinate(left, 'vertical', 0.72)
      const foldedRight = foldCoordinate(right, 'vertical', 0.72)

      expect(foldedLeft + foldedRight).toBeCloseTo(FIELD_CENTER * 2, 6)
    }
  })

  it('exchanges vertical contraction with horizontal expansion', () => {
    const position = GRID_POSITIONS[1]!
    const neutral = foldCoordinate(position, 'vertical', 0)
    const vertical = foldCoordinate(position, 'vertical', 1)
    const horizontal = foldCoordinate(position, 'horizontal', 1)

    expect(Math.abs(vertical - FIELD_CENTER)).toBeLessThan(Math.abs(neutral - FIELD_CENTER))
    expect(Math.abs(horizontal - FIELD_CENTER)).toBeGreaterThan(Math.abs(neutral - FIELD_CENTER))
  })

  it('keeps the slow breathing visibly within a restrained nine-pixel range', () => {
    const position = GRID_POSITIONS[0]!
    const neutral = foldCoordinate(position, 'vertical', 0)
    const contracted = foldCoordinate(position, 'vertical', 1)
    const movement = Math.abs(contracted - neutral)

    expect(movement).toBeGreaterThanOrEqual(8.5)
    expect(movement).toBeLessThanOrEqual(9.5)
  })

  it('distorts a grid line around the pointer instead of pulling the whole line', () => {
    const position = GRID_POSITIONS[5]!
    const upperLens = buildFoldPath('vertical', position, 0, {
      x: position + 36,
      y: 176,
      influence: 1,
    })
    const lowerLens = buildFoldPath('vertical', position, 0, {
      x: position + 36,
      y: 544,
      influence: 1,
    })

    expect(upperLens).not.toBe(lowerLens)
  })

  it('makes central lines clearer while fading the field boundary', () => {
    const center = lineAppearance(FIELD_CENTER)
    const edge = lineAppearance(GRID_POSITIONS[0]!)

    expect(center.opacity).toBeGreaterThan(edge.opacity)
    expect(center.blur).toBeLessThan(edge.blur)
    expect(edge.opacity).toBeGreaterThanOrEqual(0.04)
  })

  it('gives mirrored lines the same subtle phase while staggering depth layers', () => {
    const left = GRID_POSITIONS[1]!
    const right = GRID_POSITIONS[GRID_POSITIONS.length - 2]!

    expect(lineBreath(left, 4200)).toBeCloseTo(lineBreath(right, 4200), 6)
    expect(lineBreath(left, 4200)).not.toBeCloseTo(lineBreath(FIELD_CENTER, 4200), 3)
  })

  it('changes path curvature without moving its outer anchors', () => {
    const position = GRID_POSITIONS[2]!
    const neutral = buildFoldPath('vertical', position, 0)
    const breathing = buildFoldPath('vertical', position, 1)

    expect(breathing).not.toBe(neutral)
    expect(neutral.startsWith(`M ${position} 56`)).toBe(true)
    expect(breathing.endsWith(`${position} 664`)).toBe(true)
  })
})
