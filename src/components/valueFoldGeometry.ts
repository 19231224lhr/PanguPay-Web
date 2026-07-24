export const FIELD_CENTER = 360
export const GRID_START = 56
export const GRID_END = 664
export const GRID_POSITIONS = [72, 120, 168, 216, 264, 312, 360, 408, 456, 504, 552, 600, 648]

export type FoldAxis = 'vertical' | 'horizontal'

export interface FoldPointer {
  x: number
  y: number
  influence: number
}

const MAX_DISTANCE = 288
const POINTER_RADIUS = 160
const POINTER_STRENGTH = 0.22
const PATH_SAMPLE_COUNT = 13

interface FoldPoint {
  x: number
  y: number
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function format(value: number): string {
  return Number(value.toFixed(3)).toString()
}

export function foldCoordinate(position: number, axis: FoldAxis, breath: number): number {
  if (position === FIELD_CENTER) return FIELD_CENTER

  const distance = Math.abs(position - FIELD_CENTER)
  const distanceRatio = clamp(distance / MAX_DISTANCE, 0, 1)
  const directionToCenter = Math.sign(FIELD_CENTER - position)
  const baseInfluence = 0.18 + 0.14 * (1 - distanceRatio)
  const breathingAmplitude = 1.125 + 7.875 * distanceRatio
  const axisBreath = axis === 'vertical' ? breath : -breath
  return (
    position +
    (FIELD_CENTER - position) * baseInfluence +
    directionToCenter * axisBreath * breathingAmplitude
  )
}

function distortByLens(point: FoldPoint, pointer?: FoldPointer): FoldPoint {
  if (!pointer?.influence) return point

  const x = point.x - pointer.x
  const y = point.y - pointer.y
  const distance = Math.hypot(x, y)
  if (!distance || distance >= POINTER_RADIUS) return point

  const proximity = 1 - distance / POINTER_RADIUS
  const scale = 1 + POINTER_STRENGTH * proximity ** 2 * clamp(pointer.influence, 0, 1)

  return {
    x: pointer.x + x * scale,
    y: pointer.y + y * scale,
  }
}

function buildFoldPoints(
  axis: FoldAxis,
  position: number,
  breath: number,
  pointer?: FoldPointer,
): FoldPoint[] {
  const folded = foldCoordinate(position, axis, breath)

  return Array.from({ length: PATH_SAMPLE_COUNT }, (_, index) => {
    const progress = index / (PATH_SAMPLE_COUNT - 1)
    const along = GRID_START + (GRID_END - GRID_START) * progress
    const bend = Math.sin(Math.PI * progress) ** 2
    const across = position + (folded - position) * bend
    const point = axis === 'vertical' ? { x: across, y: along } : { x: along, y: across }

    return index === 0 || index === PATH_SAMPLE_COUNT - 1 ? point : distortByLens(point, pointer)
  })
}

function buildSmoothPath(points: FoldPoint[]): string {
  const last = points.length - 1
  const commands = [`M ${format(points[0]!.x)} ${format(points[0]!.y)}`]

  for (let index = 0; index < last; index += 1) {
    const previous = points[Math.max(0, index - 1)]!
    const start = points[index]!
    const end = points[index + 1]!
    const next = points[Math.min(last, index + 2)]!
    const controlStart = {
      x: start.x + (end.x - previous.x) / 6,
      y: start.y + (end.y - previous.y) / 6,
    }
    const controlEnd = {
      x: end.x - (next.x - start.x) / 6,
      y: end.y - (next.y - start.y) / 6,
    }

    commands.push(
      `C ${format(controlStart.x)} ${format(controlStart.y)} ${format(controlEnd.x)} ${format(controlEnd.y)} ${format(end.x)} ${format(end.y)}`,
    )
  }

  return commands.join(' ')
}

export function buildFoldPath(
  axis: FoldAxis,
  position: number,
  breath: number,
  pointer?: FoldPointer,
): string {
  return buildSmoothPath(buildFoldPoints(axis, position, breath, pointer))
}

export function lineAppearance(position: number): {
  opacity: number
  blur: number
  phaseMs: number
} {
  const distanceRatio = clamp(Math.abs(position - FIELD_CENTER) / MAX_DISTANCE, 0, 1)
  return {
    opacity: 0.2 - 0.14 * distanceRatio,
    blur: 0.45 * distanceRatio ** 1.8,
    phaseMs: 80 + Math.round(distanceRatio * 80),
  }
}

export function lineBreath(position: number, elapsedMs: number): number {
  const { phaseMs } = lineAppearance(position)
  return Math.sin(((elapsedMs + phaseMs) / 14_000) * Math.PI * 2)
}
