import { brandRelief } from './brandRelief'

// Original procedural solids, shaded before halftone sampling. No image or model downloads.
export const entryShapes = ['brand', 'create', 'import', 'key', 'shield', 'organization', 'wallet'] as const
export type EntryShape = (typeof entryShapes)[number]
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
const count = 14000
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
// The identity card emerges through the wallet lip. Its front carries a
// raised portrait and plus, both cut from the same face rather than floating.
const cardTilt = -0.11
const cardCos = Math.cos(cardTilt), cardSin = Math.sin(cardTilt)
function newAccountWallet(x: number, y: number, z: number) {
  const body = wallet((x + 3) / 0.8, (y - 43) / 0.8, z / 0.8) * 0.8
  const u = cardCos * x + cardSin * (y + 49)
  const v = -cardSin * x + cardCos * (y + 49)
  const cornerX = Math.abs(u) - 63, cornerY = Math.abs(v) - 35
  const outline = Math.hypot(Math.max(0, cornerX), Math.max(0, cornerY))
    + Math.min(Math.max(cornerX, cornerY), 0) - 8
  const card = Math.max(outline, Math.abs(z + 1) - 2.5) - 2
  const head = Math.hypot(u + 26, v + 17) - 10.5
  const shoulders = Math.max(Math.hypot(u + 26, v - 18) - 20, v - 14)
  const plus = Math.min(Math.max(Math.abs(u - 27) - 15, Math.abs(v + 6) - 3.5),
    Math.max(Math.abs(u - 27) - 3.5, Math.abs(v + 6) - 15))
  const emboss = Math.max(Math.min(head, shoulders, plus), Math.abs(z - 4) - 1.5) - 1.5
  return Math.min(body, card, emboss)
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
// The rounded crest follows the broad shoulders, curved sides and pointed base of a shield.
const crest = [
  [0, -91],
  [39, -78],
  [77, -73],
  [76, -17],
  [69, 18],
  [55, 46],
  [33, 72],
  [0, 97],
] as const
const crestEdges = crest.slice(1).map(([x, y], i) => {
  const [ax, ay] = crest[i]!
  const length = Math.hypot(x - ax, y - ay)
  return { ax, ay, nx: (y - ay) / length, ny: (ax - x) / length }
})

function crestEdge(x: number, y: number) {
  const u = Math.abs(x)
  // The two sloping top segments form a crown that dips toward the shoulders.
  const brow = crestEdges[0]!,
    shoulder = crestEdges[1]!
  let edge = Math.min(
    (u - brow.ax) * brow.nx + (y - brow.ay) * brow.ny,
    (u - shoulder.ax) * shoulder.nx + (y - shoulder.ay) * shoulder.ny,
  )
  for (let i = 2; i < crestEdges.length; i++) {
    const e = crestEdges[i]!
    edge = Math.max(edge, (u - e.ax) * e.nx + (y - e.ay) * e.ny)
  }
  return edge
}

function checkStroke(x: number, y: number) {
  const left = clamp(((x + 33) * 25 + (y + 5) * 25) / 1250)
  const right = clamp(((x + 8) * 48 - (y - 20) * 54) / 5220)
  return Math.min(
    Math.hypot(x + 33 - left * 25, y + 5 - left * 25),
    Math.hypot(x + 8 - right * 48, y - 20 + right * 54),
  )
}

function shield(x: number, y: number, z: number) {
  const edge = crestEdge(x, y),
    front = z + x * x * 0.0016 + y * y * 0.00045
  const depth = Math.abs(front) - 9
  const body =
    Math.hypot(Math.max(0, edge), Math.max(0, depth)) + Math.min(Math.max(edge, depth), 0) - 8
  const piping = Math.hypot(edge + 5, front - 17) - 3
  return Math.min(body, piping, Math.hypot(checkStroke(x, y), front - 20) - 7)
}

function shieldInk(x: number, y: number, z: number, shading: number) {
  if (z + x * x * 0.0016 + y * y * 0.00045 < 15 || crestEdge(x, y) > -10) return shading
  return checkStroke(x, y) < 7 ? 0.63 + 0.36 * shading : 0.07 + 0.44 * shading
}

// A sphere and a softly beveled circular cone make up each figure.
// The two smaller figures stand behind the central one in the same orthographic light.
const figures = [
  { x: -78, y: -8, z: -24, scale: 0.82 },
  { x: 78, y: -8, z: -24, scale: 0.82 },
  { x: 0, y: 5, z: 23, scale: 1 },
] as const

// A shared crest stands in front of the group, below the three heads.
const organizationCrest = { x: -58, y: 68, z: 72, scale: 0.60 }
const coneSlope = 0.45
const coneNormalLength = Math.hypot(1, coneSlope)

function organization(x: number, y: number, z: number) {
  let distance = Infinity
  for (const figure of figures) {
    const px = (x - figure.x) / figure.scale
    const py = (y - figure.y) / figure.scale
    const pz = (z - figure.z) / figure.scale
    const sphere = Math.hypot(px, py + 49, pz) - 23
    const side = (Math.hypot(px, pz) - (py + 20) * coneSlope) / coneNormalLength
    const cone = Math.max(side, py - 65) - 1.6
    distance = Math.min(distance, Math.min(sphere, cone) * figure.scale)
  }
  const { x: bx, y: by, z: bz, scale } = organizationCrest
  return Math.min(distance, shield((x - bx) / scale, (y - by) / scale, (z - bz) / scale) * scale)
}

function distance(kind: EntryShape, x: number, y: number, z: number) {
  if (kind === 'brand') return brandRelief(x, y, z)
  if (kind === 'wallet') return Math.min(...homeParts(x, y, z))
  if (kind === 'create') return newAccountWallet(x, y, z)
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
  return kind === 'organization' ? organization(x, y, z) : shield(x, y, z)
}

export function* buildShapeRows(kind: EntryShape): Generator<void, Particle[]> {
  const cached = cache.get(kind)
  if (cached) return cached
  // Fixed orthographic grid creates a deliberate print pattern. Normal lighting controls dot area.
  const points: Particle[] = []
  const yaw = 0.38
  const pitch = -0.23
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw),
    cx = Math.cos(pitch),
    sx = Math.sin(pitch)
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
      if (kind === 'create') {
        const yy = y * cx - z * sx, zz = y * sx + z * cx
        const wz = x * sy + zz * cy
        // Stronger ink on the raised glyphs keeps the account readable at small sizes.
        if (yy < -24 && wz > 4) ink = 0.67 + ink * 0.32
      }
      if (kind === 'shield' || kind === 'organization') {
        const yy = y * cx - z * sx,
          zz = y * sx + z * cx
        const wx = x * cy - zz * sy,
          wz = x * sy + zz * cy
        if (kind === 'shield') {
          ink = shieldInk(wx, yy, wz, ink)
        } else {
          const { x: bx, y: by, z: bz, scale } = organizationCrest
          const u = (wx - bx) / scale, v = (yy - by) / scale, w = (wz - bz) / scale
          if (shield(u, v, w) * scale < 0.2) ink = shieldInk(u, v, w, ink)
        }
      }
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
    yield
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

export function buildShape(kind: EntryShape): Particle[] {
  const rows = buildShapeRows(kind)
  let row = rows.next()
  while (!row.done) row = rows.next()
  return row.value
}
