import {
  buildShape,
  buildShapeRows,
  entryShapes,
  type EntryShape,
  type Particle,
} from './entryShapeGeometry'
import type { UnlockPhase } from '@/composables/useEntryUnlock'
export { buildShape, type EntryShape, type Particle } from './entryShapeGeometry'

const clamp = (n: number) => Math.max(0, Math.min(1, n))
const smooth = (n: number) => {
  const t = clamp(n)
  return t * t * t * (t * (t * 6 - 15) + 10)
}
const mix = (a: number, b: number, t: number) => a + (b - a) * t

export function unlockParticle(
  p: Particle,
  time: number,
  activity: number,
  release: number,
  index: number,
  reduced = false,
): Particle {
  const fade = smooth(release)
  if (reduced) return { ...p, alpha: p.alpha * (1 - fade) }
  // Settle into a soft cloud once; independent phases keep it alive without a shared orbit.
  const angle = index * 2.399963
  const seed = Math.sin(index * 127.1 + 311.7) * 43758.5453
  const spread = 75 * Math.sqrt(-2 * Math.log(Math.max(0.001, seed - Math.floor(seed))))
  const dispersed = activity * smooth(time / 2.6)
  const driftX = 22 * Math.sin(time * (0.18 + (index % 13) * 0.009) + angle)
  const driftY = 20 * Math.sin(time * (0.15 + (index % 17) * 0.008) + angle * 1.7)
  return {
    ...p,
    x: mix(p.x, Math.cos(angle) * spread + driftX, dispersed),
    y: mix(p.y, Math.sin(angle) * spread * 0.85 + driftY, dispersed),
    z: mix(p.z, Math.sin(angle * 1.3) * spread * 0.3, dispersed),
    alpha: p.alpha * (1 - fade),
  }
}

const morphSeconds = 2.6

function morphWeights(progress: number, moving: boolean) {
  const t = clamp(progress),
    remaining = 1 - t
  return {
    blend: moving ? t * t * (3 - 2 * t) : 1 - remaining * remaining,
    // Carry the outgoing tangent across a turn, then let the new target take over.
    carry: t * remaining ** 5 * morphSeconds,
    scatter: 16 * t * t * remaining * remaining,
  }
}

function scatterVector(index: number) {
  const angle = index * 2.399963,
    spread = 32 + (index % 89)
  return {
    x: Math.cos(angle) * spread,
    y: Math.sin(angle) * spread * 0.65,
    z: Math.sin(angle * 1.3) * 64,
  }
}

type Vector = Pick<Particle, 'x' | 'y' | 'z'>
function interpolate(
  out: Particle,
  a: Particle,
  b: Particle,
  weights: ReturnType<typeof morphWeights>,
  scatter: Vector,
  velocity: Vector,
) {
  const { blend, carry } = weights
  out.x = mix(a.x, b.x, blend) + scatter.x * weights.scatter + velocity.x * carry
  out.y = mix(a.y, b.y, blend) + scatter.y * weights.scatter + velocity.y * carry
  out.z = mix(a.z, b.z, blend) + scatter.z * weights.scatter + velocity.z * carry
  out.radius = mix(a.radius, b.radius, blend) * (1 - weights.scatter * 0.4)
  out.alpha = mix(a.alpha, b.alpha, blend)
  out.group = mix(a.group, b.group, blend)
  return out
}

export function morphParticle(a: Particle, b: Particle, progress: number, index: number): Particle {
  return interpolate({ ...a }, a, b, morphWeights(progress, false), scatterVector(index), {
    x: 0,
    y: 0,
    z: 0,
  })
}

export function createParticleScene(canvas: HTMLCanvasElement, initial: EntryShape) {
  const context = canvas.getContext('2d')
  if (!context)
    return {
      setShape: (_shape: EntryShape) => {},
      setPhase: (_phase: UnlockPhase) => {},
      waitForBrand: async () => {},
      destroy: () => {},
    }
  const ctx = context
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  let inkColor = getComputedStyle(canvas).color
  const themeObserver = new MutationObserver(() => {
    inkColor = getComputedStyle(canvas).color
    if (media.matches) draw(0)
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style'],
  })
  let target = buildShape(initial)
  const source = target.map((p) => ({ ...p, x: p.x * 1.5, y: p.y * 1.5, alpha: 0 }))
  let progress = media.matches ? 1 : 0
  let current = (media.matches ? target : source).map((p) => ({ ...p }))
  let previous = source.map((p) => ({ ...p }))
  const scatter = target.map((_, i) => scatterVector(i))
  const velocity = target.map(() => ({ x: 0, y: 0, z: 0 }))
  // Sample once per scene so switching shapes never reshuffles the surrounding dust.
  const dust = Array.from({ length: 118 }, () => {
    const x = Math.random() * 2 - 1
    const y = Math.random() * 2 - 1
    const edgeFade = smooth((1 - Math.abs(x)) * 3) * smooth((1 - Math.abs(y)) * 3)
    return {
      x: x * 265, y: y * 205, size: 0.65 + Math.random() * 1.15,
      opacity: (0.18 + Math.random() * 0.32) * edgeFade,
      phase: Math.random() * Math.PI * 2, speed: 0.18 + Math.random() * 0.35,
    }
  })
  let moving = false,
    previousDt = 0
  let width = 0,
    height = 0,
    last = 0,
    elapsed = 0,
    raf = 0,
    stopped = false,
    visible = true
  let pointerX = 0,
    pointerY = 0,
    tiltX = 0,
    tiltY = 0
  let requested = initial,
    active = initial
  const targets = new Map<EntryShape, Particle[]>([[initial, target]])
  const unfinished = new Map<EntryShape, ReturnType<typeof buildShapeRows>>()
  let worker: Worker | undefined
  let phase: UnlockPhase = 'idle',
    activity = 0,
    release = 0,
    unlockTime = 0
  function retarget(shape: EntryShape, points: Particle[]) {
    if (stopped || shape !== requested || shape === active) return
    // Snapshot only when the target is ready: the live scene keeps floating while it loads.
    for (let i = 0; i < current.length; i++) {
      const p = current[i]!,
        prior = previous[i]!,
        v = velocity[i]!
      v.x = previousDt > 0 ? (p.x - prior.x) / previousDt : 0
      v.y = previousDt > 0 ? (p.y - prior.y) / previousDt : 0
      v.z = previousDt > 0 ? (p.z - prior.z) / previousDt : 0
      Object.assign(source[i]!, p)
    }
    moving = previousDt > 0
    target = points
    active = shape
    progress = 0
    canvas.dataset.shape = shape
  }
  try {
    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./entryShapes.worker.ts', import.meta.url), { type: 'module' })
      const prewarm = () => {
        // Keep only one build queued so a click can take priority over speculative work.
        const next = !targets.has(requested)
          ? requested
          : entryShapes.find((shape) => !targets.has(shape))
        if (next) worker?.postMessage(next)
      }
      worker.onmessage = (event: MessageEvent<{ shape: EntryShape; points: Particle[] }>) => {
        const { shape, points } = event.data
        targets.set(shape, points)
        retarget(shape, points)
        prewarm()
      }
      worker.onerror = () => {
        worker?.terminate()
        worker = undefined
      }
      // Prepare all subsequent steps off the UI thread before they are needed.
      prewarm()
    }
  } catch {
    worker = undefined
  }
  function prepareWithoutWorker() {
    if (worker || requested === active) return
    let rows = unfinished.get(requested)
    if (!rows) {
      rows = buildShapeRows(requested)
      unfinished.set(requested, rows)
    }
    // Browsers that block module workers can still keep drawing between slices of geometry.
    const end = performance.now() + 3
    do {
      const row = rows.next()
      if (row.done) {
        targets.set(requested, row.value)
        unfinished.delete(requested)
        retarget(requested, row.value)
        return
      }
    } while (performance.now() < end)
  }
  const anchor = canvas.parentElement!
  let centerX = 0,
    centerY = 0,
    scale = 0
  function resize() {
    const r = canvas.getBoundingClientRect()
    width = r.width
    height = r.height
    const box = anchor.getBoundingClientRect()
    centerX = box.left + box.width / 2 - r.left
    centerY = box.top + box.height * 0.46 - r.top
    scale = Math.min(box.width / 500, box.height / 420)
    const ratio = Math.min(devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * ratio),
      pixelHeight = Math.round(height * ratio)
    if (canvas.width !== pixelWidth) canvas.width = pixelWidth
    if (canvas.height !== pixelHeight) canvas.height = pixelHeight
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  function draw(dt: number) {
    const blend = 1 - Math.exp(-dt * 4)
    tiltX += (pointerX - tiltX) * blend
    tiltY += (pointerY - tiltY) * blend
    const yaw = media.matches ? 0 : tiltX * 0.14 + Math.sin(elapsed * 0.4) * 0.035
    const pitch = media.matches ? 0 : tiltY * 0.1
    const cy = Math.cos(yaw),
      sy = Math.sin(yaw),
      cx = Math.cos(pitch),
      sx = Math.sin(pitch)
    // Float belongs to the persistent scene clock, never to a route's morph progress.
    const float = media.matches ? 0 : smooth(elapsed / 3.4) * 3
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = inkColor
    const dustVisibility = 1 - smooth(release)
    for (const speck of dust) {
      const wave = media.matches ? 0 : Math.sin(elapsed * speck.speed + speck.phase)
      ctx.globalAlpha = speck.opacity * dustVisibility * (0.8 + 0.2 * wave)
      ctx.fillRect(centerX + speck.x * scale, centerY + (speck.y + wave * 2.4) * scale,
        speck.size * scale, speck.size * scale)
    }
    const fadeProgress = active === 'brand' ? clamp(release / 0.78) : release
    for (let i = 0; i < current.length; i++) {
      const p =
        activity > 0.0001 || release > 0
          ? unlockParticle(current[i]!, unlockTime, active === 'brand' ? 0 : activity, fadeProgress, i, media.matches)
          : current[i]!
      if (p.alpha < 0.01) continue
      const x = p.x * cy + p.z * sy + Math.sin(elapsed * 0.55 + p.group * 2.1) * float,
        z = -p.x * sy + p.z * cy,
        y = p.y * cx - z * sx + Math.sin(elapsed * 0.65 + p.group * 2.5) * float
      const px = centerX + x * scale,
        py = centerY + y * scale
      const r = Math.max(0.2, p.radius * scale)
      ctx.globalAlpha = p.alpha
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    canvas.dataset.progress = progress.toFixed(2)
    canvas.dataset.phase = phase
  }
  function frame(now: number) {
    if (stopped) return
    const dt = Math.min((now - last) / 1000 || 0, 0.1)
    last = now
    if (!document.hidden && visible) {
      prepareWithoutWorker()
      activity += ((phase === 'idle' ? 0 : 1) - activity) * (1 - Math.exp(-dt * 3))
      if (activity > 0.0001) unlockTime += dt
      else unlockTime = 0
      release = phase === 'revealing' ? clamp(release + dt / (media.matches ? 0.18 : 1.1)) : 0
      if (!media.matches) elapsed += dt
      if (progress < 1 && (dt > 0 || media.matches)) {
        progress = media.matches ? 1 : clamp(progress + dt / morphSeconds)
        if (progress === 1) {
          for (let i = 0; i < current.length; i++) Object.assign(current[i]!, target[i]!)
          previousDt = 0
        } else {
          const weights = morphWeights(progress, moving)
          if (active === 'brand' && !moving) weights.blend = smooth(progress)
          ;[previous, current] = [current, previous]
          for (let i = 0; i < current.length; i++)
            interpolate(current[i]!, source[i]!, target[i]!, weights, scatter[i]!, velocity[i]!)
          previousDt = dt
        }
      }
      draw(dt)
    }
    raf = requestAnimationFrame(frame)
  }
  const resizeObserver = new ResizeObserver(resize)
  resizeObserver.observe(canvas)
  resizeObserver.observe(anchor)
  const anchorObserver = new MutationObserver(resize)
  anchorObserver.observe(anchor, { attributes: true, attributeFilter: ['style'] })
  const observer = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true
  })
  observer.observe(canvas)
  const move = (e: PointerEvent) => {
    const r = anchor.getBoundingClientRect()
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
      pointerX = pointerY = 0
      return
    }
    pointerX = (e.clientX - r.left) / r.width - 0.5
    pointerY = (e.clientY - r.top) / r.height - 0.5
  }
  const leave = () => {
    pointerX = pointerY = 0
  }
  window.addEventListener('pointermove', move)
  document.addEventListener('pointerleave', leave)
  resize()
  raf = requestAnimationFrame(frame)
  return {
    async waitForBrand() {
      // The request runs alongside the assembly. Only a very fast response needs
      // to wait for the last dots. Hidden or unavailable canvases never gate entry.
      if (media.matches || document.hidden || !scale || !visible) return
      await new Promise<void>((resolve) => {
        let checkFrame = 0
        function finish() {
          cancelAnimationFrame(checkFrame)
          window.clearTimeout(deadline)
          resolve()
        }
        function check() {
          if (stopped || !visible || document.hidden || (active === 'brand' && progress === 1)) finish()
          else checkFrame = requestAnimationFrame(check)
        }
        const deadline = window.setTimeout(finish, (morphSeconds + 0.75) * 1000)
        check()
      })
    },
    setPhase(next: UnlockPhase) {
      phase = next
    },
    setShape(shape: EntryShape) {
      requested = shape
      if (shape === active) return
      const points = targets.get(shape)
      if (points) retarget(shape, points)
    },
    destroy() {
      stopped = true
      cancelAnimationFrame(raf)
      worker?.terminate()
      resizeObserver.disconnect()
      anchorObserver.disconnect()
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('pointermove', move)
      document.removeEventListener('pointerleave', leave)
    },
  }
}
