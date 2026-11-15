import { buildShape, type EntryShape, type Particle } from './entryShapeGeometry'
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

export function morphParticle(a: Particle, b: Particle, progress: number, index: number): Particle {
  const delay = (index % 19) / 130
  const t = clamp((progress - delay) / (1 - delay)),
    m = smooth((t - 0.1) / 0.9)
  const bloom = Math.sin(Math.PI * smooth(t)) ** 2
  const angle = index * 2.399963 + smooth(t) * 1.5
  const spread = 38 + (index % 103)
  return {
    x: mix(a.x, b.x, m) + Math.cos(angle) * spread * bloom,
    y: mix(a.y, b.y, m) + Math.sin(angle) * spread * 0.65 * bloom,
    z: mix(a.z, b.z, m) + Math.sin(angle * 1.3) * 80 * bloom,
    radius: mix(a.radius, b.radius, m) * (1 - bloom * 0.48),
    alpha: mix(a.alpha, b.alpha, m),
    group: mix(a.group, b.group, m),
  }
}

export function createParticleScene(canvas: HTMLCanvasElement, initial: EntryShape) {
  const context = canvas.getContext('2d')
  if (!context)
    return {
      setShape: (_shape: EntryShape) => {},
      setPhase: (_phase: UnlockPhase) => {},
      destroy: () => {},
    }
  const ctx = context
  const media = matchMedia('(prefers-reduced-motion: reduce)')
  let inkColor = getComputedStyle(canvas).color
  const themeObserver = new MutationObserver(() => {
    inkColor = getComputedStyle(canvas).color
  })
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme', 'style'],
  })
  let target = buildShape(initial),
    source = target.map((p) => ({ ...p, x: p.x * 1.5, y: p.y * 1.5, alpha: 0 }))
  let current = source.map((p) => ({ ...p })),
    progress = media.matches ? 1 : 0
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
  let worker: Worker | undefined
  let phase: UnlockPhase = 'idle',
    activity = 0,
    release = 0,
    unlockTime = 0
  function retarget(shape: EntryShape, points: Particle[]) {
    if (stopped || shape !== requested || shape === active) return
    // Snapshot only when the target is ready: the live scene keeps floating while it loads.
    source = current.map((p) => ({ ...p }))
    target = points
    active = shape
    progress = 0
    canvas.dataset.shape = shape
  }
  try {
    if (typeof Worker !== 'undefined') {
      worker = new Worker(new URL('./entryShapes.worker.ts', import.meta.url), { type: 'module' })
      worker.onmessage = (event: MessageEvent<{ shape: EntryShape; points: Particle[] }>) => {
        const { shape, points } = event.data
        targets.set(shape, points)
        retarget(shape, points)
      }
      worker.onerror = () => {
        worker?.terminate()
        worker = undefined
        if (!stopped && requested !== active) retarget(requested, buildShape(requested))
      }
      // Prepare all subsequent steps off the UI thread before they are needed.
      for (const shape of ['key', 'create', 'import', 'shield', 'wallet'] as EntryShape[])
        if (shape !== initial) worker.postMessage(shape)
    }
  } catch {
    worker = undefined
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
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
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
    for (let i = 0; i < current.length; i++) {
      const p =
        activity > 0.0001 || release > 0
          ? unlockParticle(current[i]!, unlockTime, activity, release, i, media.matches)
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
    // Sparse peripheral dust stays subordinate to the shaded object.
    ctx.globalAlpha = 0.38 * (1 - smooth(release))
    for (let i = 0; i < 85; i++) {
      const a = i * 2.39996,
        orbit = 165 + (i % 41) * 1.8
      const x = Math.cos(a) * orbit,
        y = Math.sin(a) * orbit * 0.76 + Math.sin(elapsed * 0.25 + i) * 4
      const r = (0.35 + (i % 5) * 0.13) * scale
      ctx.fillRect(centerX + x * scale, centerY + y * scale, r * 2, r * 2)
    }
    ctx.globalAlpha = 1
    canvas.dataset.progress = progress.toFixed(2)
    canvas.dataset.phase = phase
  }
  function frame(now: number) {
    if (stopped) return
    const dt = Math.min((now - last) / 1000 || 0, 0.04)
    last = now
    if (!document.hidden && visible) {
      activity += ((phase === 'idle' ? 0 : 1) - activity) * (1 - Math.exp(-dt * 3))
      if (activity > 0.0001) unlockTime += dt
      else unlockTime = 0
      release = phase === 'revealing' ? clamp(release + dt / (media.matches ? 0.18 : 1.1)) : 0
      if (!media.matches) elapsed += dt
      progress = media.matches ? 1 : clamp(progress + dt / 3.4)
      if (progress < 1) current = source.map((p, i) => morphParticle(p, target[i]!, progress, i))
      else current = target
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
    setPhase(next: UnlockPhase) {
      phase = next
    },
    setShape(shape: EntryShape) {
      requested = shape
      if (shape === active) return
      const points = targets.get(shape)
      if (points) retarget(shape, points)
      else if (!worker) {
        const generated = buildShape(shape)
        targets.set(shape, generated)
        retarget(shape, generated)
      }
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
