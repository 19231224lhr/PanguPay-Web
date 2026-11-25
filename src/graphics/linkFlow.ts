// The node console's CurveMark link: a Bernoulli lemniscate with a tapered
// 32-dot trail. Keep this renderer self-contained: Vite also embeds it in the
// initial HTML so a wallet reload can show the very same motion before Vue.
export function mountLinkFlow(svg: SVGSVGElement) {
  const ns = 'http://www.w3.org/2000/svg'
  const duration = 4800
  const count = 32
  function point(turn: number) {
    const t = turn * 2 * Math.PI
    const sine = Math.sin(t)
    const x = 40 * Math.cos(t) / (1 + sine * sine)
    return [(50 + x).toFixed(3), (50 + x * sine).toFixed(3)]
  }
  const samples = Array.from({ length: 241 }, (_, i) => point(i / 240))
  const path = document.createElementNS(ns, 'path')
  path.setAttribute('d', 'M' + samples.map(p => p.join(',')).join('L') + 'Z')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '6')
  path.setAttribute('opacity', '.22')
  const group = document.createElementNS(ns, 'g')
  group.append(path)
  svg.append(group)
  const dots = Array.from({ length: count }, (_, i) => {
    const dot = document.createElementNS(ns, 'circle')
    const weight = 1 - (i + 1) / count
    dot.setAttribute('r', String(0.9 + 4.3 * weight))
    dot.setAttribute('opacity', String(0.08 + 0.92 * weight ** 0.65))
    dot.setAttribute('fill', 'currentColor')
    group.append(dot)
    return dot
  })
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  const frames = samples.map(([x, y]) => ({ transform: `translate(${x}px,${y}px)` }))
  let animations: Animation[] = []
  function update() {
    for (const animation of animations) animation.cancel()
    animations = []
    const clock = Date.now()
    dots.forEach((dot, i) => {
      const offset = (i / count) * 0.36
      const [x, y] = point(0.2 - offset)
      dot.style.transform = `translate(${x}px,${y}px)`
      if (reduced?.matches || !dot.animate) return
      const animation = dot.animate(frames, { duration, iterations: Infinity })
      // A document change may take any length of time. Both ends sample the
      // same clock, so the tip resumes on the correct branch of the eight.
      animation.currentTime = ((clock % duration) + duration * (1 - offset)) % duration
      animations.push(animation)
    })
    if (!reduced?.matches && group.animate) {
      const period = 2 * Math.PI * 1500
      group.style.transformOrigin = '50px 50px'
      const breath = Array.from({ length: 65 }, (_, i) => ({
        transform: `scale(${0.96 + 0.04 * Math.sin(i * 2 * Math.PI / 64)})`,
      }))
      const animation = group.animate(breath, { duration: period, iterations: Infinity })
      animation.currentTime = clock % period
      animations.push(animation)
    }
  }
  update()
  reduced?.addEventListener?.('change', update)
  return () => {
    reduced?.removeEventListener?.('change', update)
    for (const animation of animations) animation.cancel()
    group.remove()
  }
}
