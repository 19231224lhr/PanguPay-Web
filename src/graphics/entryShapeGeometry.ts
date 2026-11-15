// Original procedural solids, shaded before halftone sampling. No image or model downloads.
export type EntryShape = 'wallet' | 'key' | 'create' | 'import' | 'shield'
export type Particle = {
  x: number
  y: number
  z: number
  radius: number
  alpha: number
  group: number
}
const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => {
  const t = clamp(n)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const count = 26000
const cache = new Map<EntryShape, Particle[]>()

function box(x: number, y: number, z: number, w: number, h: number, d: number, r: number) {
  const a = Math.abs(x) - w + r,
    b = Math.abs(y) - h + r,
    c = Math.abs(z) - d + r
  return (
    Math.hypot(Math.max(a, 0), Math.max(b, 0), Math.max(c, 0)) + Math.min(Math.max(a, b, c), 0) - r
  )
}
function wallet(x: number, y: number, z: number) {
  let body = box(x, y, z + x * x * 0.0016 + y * y * 0.0012, 119, 78, 28, 22)
  // Open lip, recessed seam and a raised clasp cast distinct bands of shade.
  body = Math.max(body, -box(x, y + 64, z - 4, 95, 5, 24, 4))
  const seam = Math.max(box(x, y, z - 24, 108, 67, 2.2, 9), -box(x, y, z - 24, 105, 64, 5, 8))
  body = Math.max(body, -seam)
  const clasp = box(x - 86, y - 5, z - 31, 43, 24, 9, 8)
  const stud = Math.hypot(x - 71, y - 5, z - 42) - 7
  return Math.min(body, clasp, stud)
}
function bitcoinMark(x: number, y: number) {
  const upper = Math.max(Math.abs(Math.hypot(x + 1, y + 13) - 14) - 3.5, -x - 1)
  const lower = Math.max(Math.abs(Math.hypot(x + 1, y - 12) - 15) - 3.5, -x - 1)
  return Math.min(
    upper,
    lower,
    box(x + 10, y, 0, 3, 28, 5, 1),
    box(x + 4, y + 27, 0, 8, 3, 5, 1),
    box(x + 4, y, 0, 8, 3, 5, 1),
    box(x + 4, y - 27, 0, 8, 3, 5, 1),
    box(x + 7, y, 0, 1.3, 35, 5, 0.5),
    box(x - 1, y, 0, 1.3, 35, 5, 0.5),
  )
}
function homeParts(x: number, y: number, z: number) {
  const bx = x + 73,
    by = y + 59,
    bz = z + 20
  const u = bx * 0.98 + by * 0.2,
    v = -bx * 0.2 + by * 0.98
  const coin = Math.hypot(Math.max(Math.hypot(u, v) - 48, 0), Math.max(Math.abs(bz) - 5, 0)) - 4
  const rim = Math.hypot(Math.hypot(u, v) - 44, bz - 9) - 2
  const mark = Math.max(bitcoinMark(u * 1.05, v * 1.05), Math.abs(bz - 12) - 3)
  const ex = x - 89,
    ey = y + 45,
    ez = z - 24
  const eth = Math.max(
    (Math.abs(ex) / 37 + Math.abs(ey) / 65 + Math.abs(ez) / 24 - 1) * 18,
    3 - Math.abs(ey - 13),
  )
  return [
    wallet((x + 13) / 0.78, (y - 44) / 0.78, (z - 23) / 0.78) * 0.78,
    Math.min(coin, rim, mark),
    eth,
  ]
}
function distance(kind: EntryShape, x: number, y: number, z: number) {
  if (kind === 'wallet') return Math.min(...homeParts(x, y, z))
  if (kind === 'create') {
    const body = wallet((x + 18) / 0.84, (y - 15) / 0.84, z / 0.84) * 0.84
    const disc = Math.hypot(Math.hypot(x - 103, y + 72) - 34, z - 30) - 9
    const plus = Math.min(
      box(x - 103, y + 72, z - 31, 19, 5, 8, 2),
      box(x - 103, y + 72, z - 31, 5, 19, 8, 2),
    )
    return Math.min(body, disc, plus)
  }
  if (kind === 'key') {
    const u = x * 0.84 - y * 0.54,
      v = x * 0.54 + y * 0.84
    const ring = Math.hypot(Math.hypot(u + 67, v) - 43, z) - 15
    return Math.min(
      ring,
      box(u - 36, v, z, 78, 11, 11, 4),
      box(u - 76, v - 20, z, 11, 27, 11, 3),
      box(u - 104, v - 25, z, 10, 31, 11, 3),
    )
  }
  if (kind === 'import') {
    const outer = box(x, y - 56, z, 108, 34, 39, 12)
    const inner = box(x, y - 39, z - 7, 91, 30, 34, 7)
    const tray = Math.max(outer, -inner)
    const shaft = box(x, y + 53, z - 12, 12, 45, 13, 4)
    const arrow = Math.max(Math.abs(x) + (y + 1) - 43, -(y + 39), Math.abs(z - 12) - 13)
    return Math.min(tray, shaft, arrow)
  }
  const sy = y + 10
  const shield = Math.max(
    Math.abs(x) - (sy > 5 ? 85 - (sy - 5) * 0.53 : 85),
    Math.abs(sy) - 101,
    Math.abs(z) - (25 - (x * x) / 900),
  )
  const rim = Math.max(shield, -box(x, y + 20, z - 29, 64, 70, 13, 25))
  // Screen-space Y points down: the check descends to its elbow, then rises right.
  // Rounded strokes meet continuously, so the mark reads as a check, not an arrow.
  const stroke = (ax: number, ay: number, bx: number, by: number) => {
    const dx = bx - ax,
      dy = by - ay
    const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))
    return Math.hypot(x - ax - t * dx, y - ay - t * dy, z - 35) - 7.5
  }
  return Math.min(rim, stroke(-39, -6, -12, 22), stroke(-12, 22, 43, -39))
}

export function buildShape(kind: EntryShape): Particle[] {
  const cached = cache.get(kind)
  if (cached) return cached
  // Fixed orthographic grid creates a deliberate print pattern. Normal lighting controls dot area.
  const points: Particle[] = []
  const cy = Math.cos(0.38),
    sy = Math.sin(0.38),
    cx = Math.cos(-0.23),
    sx = Math.sin(-0.23)
  const field = (x: number, y: number, z: number) => {
    const yy = y * cx - z * sx,
      zz = y * sx + z * cx
    return distance(kind, x * cy - zz * sy, yy, x * sy + zz * cy)
  }
  const step = 1.65
  for (let y = -175; y <= 175; y += step) {
    for (let x = -190; x <= 190; x += step) {
      let z = 185,
        hit = false
      for (let ray = 0; ray < 85 && z > -130; ray++) {
        const d = field(x, y, z)
        if (d < 0.16) {
          hit = true
          break
        }
        z -= Math.max(0.18, d * 0.78)
      }
      if (!hit) continue
      // A wider normal footprint softly bridges bevels instead of jumping between planes.
      const nx = field(x + 3, y, z) - field(x - 3, y, z)
      const ny = field(x, y + 3, z) - field(x, y - 3, z)
      const nz = field(x, y, z + 3) - field(x, y, z - 3)
      const len = Math.hypot(nx, ny, nz) || 1
      const diffuse = Math.max(0, (-0.4 * nx - 0.46 * ny + 0.79 * nz) / len)
      const specular = Math.pow(Math.max(0, (-0.3 * nx - 0.38 * ny + 0.87 * nz) / len), 18) * 0.32
      // Nearby surface occlusion adds depth to seams, the key ring and wallet opening.
      const occlusion = clamp(
        (8 - field(x + (nx / len) * 8, y + (ny / len) * 8, z + (nz / len) * 8)) / 8,
      )
      let ink = clamp(0.84 - diffuse * 0.76 - specular * 0.65 + occlusion * 0.12)
      let group = 0
      if (kind === 'wallet') {
        const yy = y * cx - z * sx,
          zz = y * sx + z * cx
        const wx = x * cy - zz * sy,
          wz = x * sy + zz * cy
        const parts = homeParts(wx, yy, wz)
        group = parts.indexOf(Math.min(...parts))
        if (group === 1) {
          const bx = wx + 73,
            by = yy + 59
          if (
            wz > -10 &&
            bitcoinMark((bx * 0.98 + by * 0.2) * 1.05, (-bx * 0.2 + by * 0.98) * 1.05) < 0.8
          )
            ink = 0.94
        }
      }
      // The finer circular dots are antialiased, with a continuous midtone distribution.
      points.push({
        x,
        y,
        z,
        radius: step * (0.08 + 0.67 * Math.pow(ink, 0.78)),
        alpha: 0.35 + 0.65 * smooth(Math.abs(nz) / len / 0.45),
        group,
      })
    }
  }
  // Transparent reserve points preserve particle identity across silhouettes of different area.
  const visible = points.length
  for (let i = visible; i < count; i++) {
    const anchor = points[i % visible]!
    points.push({ ...anchor, radius: 0.1, alpha: 0 })
  }
  // Stable permutation prevents the new shape assembling in scanline order.
  let seed = 901
  for (let i = points.length - 1; i > 0; i--) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    const j = seed % (i + 1)
    ;[points[i], points[j]] = [points[j]!, points[i]!]
  }
  cache.set(kind, points)
  return points
}
