<script setup lang="ts">
import LinkFlow from './LinkFlow.vue'
import { computed, onBeforeUnmount, onMounted, ref, useSlots, watch } from 'vue'

// Original implementation of mathematical curves, inspired by Math Curve Loaders.
// Keep this component identical in PanguPay-Web and PanguPay-Console.
const props = withDefaults(
  defineProps<{
    variant?: 'rose' | 'link' | 'weave'
    size?: number
    motion?: 'loop' | 'once' | 'still'
  }>(),
  { variant: 'rose', size: 44, motion: 'loop' },
)
const slots = useSlots()
const root = ref<SVGSVGElement>()
const group = ref<SVGGElement>()
const trail = ref<SVGGElement>()
const count = 32
function point(t: number): [number, number] {
  if (slots.default) return [50 + 39 * Math.cos(t), 50 + 39 * Math.sin(t)]
  if (props.variant === 'link') {
    const d = 1 + Math.sin(t) ** 2
    return [50 + (40 * Math.cos(t)) / d, 50 + (40 * Math.sin(t) * Math.cos(t)) / d]
  }
  if (props.variant === 'weave')
    return [50 + 32 * Math.sin(3 * t + Math.PI / 2), 50 + 32 * Math.sin(2 * t)]
  return [
    50 + 27 * Math.cos(t) - 11 * Math.cos(5 * t),
    50 + 27 * Math.sin(t) - 11 * Math.sin(5 * t),
  ]
}
const path = computed(
  () =>
    Array.from({ length: 241 }, (_, i) => {
      const [x, y] = point((i / 240) * Math.PI * 2)
      return `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`
    }).join(' ') + 'Z',
)
let frame = 0
let elapsed = 0
let previous = 0
let visible = false
let reduced: MediaQueryList | undefined
let observer: IntersectionObserver | undefined
let circles: SVGCircleElement[] = []
function paint() {
  const still = reduced?.matches || props.motion === 'still'
  const once = props.motion === 'once'
  const phase = still ? 0.2 : elapsed / (once ? 1600 : 4800)
  const fade = once ? Math.max(0, 1 - elapsed / 1100) : 1
  trail.value?.setAttribute('opacity', String(still ? 0.65 : fade))
  circles.forEach((circle, i) => {
    const [x, y] = point((phase - (i / count) * 0.36) * Math.PI * 2)
    circle.setAttribute('cx', x.toFixed(2))
    circle.setAttribute('cy', y.toFixed(2))
  })
  const rotate = still || slots.default || props.variant === 'link' ? 0 : elapsed / 95
  const scale = still || slots.default ? 1 : 0.96 + 0.04 * Math.sin(elapsed / 1500)
  group.value?.setAttribute(
    'transform',
    `translate(50 50) rotate(${rotate}) scale(${scale}) translate(-50 -50)`,
  )
}
function stop() {
  cancelAnimationFrame(frame)
  frame = 0
  previous = 0
}
function tick(now: number) {
  frame = 0
  if (previous) elapsed += Math.min(now - previous, 64)
  previous = now
  paint()
  if (props.motion !== 'once' || elapsed < 1100) frame = requestAnimationFrame(tick)
}
function sync() {
  stop()
  paint()
  if (
    visible &&
    !document.hidden &&
    !reduced?.matches &&
    props.motion !== 'still' &&
    (props.motion !== 'once' || elapsed < 1100)
  )
    frame = requestAnimationFrame(tick)
}
watch(
  () => [props.variant, props.motion],
  () => {
    elapsed = 0
    sync()
  },
)
onMounted(() => {
  circles = Array.from(trail.value?.querySelectorAll('circle') ?? [])
  reduced =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : undefined
  reduced?.addEventListener?.('change', sync)
  document.addEventListener('visibilitychange', sync)
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting
      sync()
    })
    if (root.value) observer.observe(root.value)
  }
  paint()
})
watch(root, (element, previousRoot) => {
  if (previousRoot) observer?.unobserve?.(previousRoot)
  visible = false
  circles = Array.from(trail.value?.querySelectorAll('circle') ?? [])
  if (element) observer?.observe(element)
  sync()
}, { flush: 'post' })
onBeforeUnmount(() => {
  stop()
  observer?.disconnect()
  reduced?.removeEventListener?.('change', sync)
  document.removeEventListener('visibilitychange', sync)
})
</script>

<template>
  <span class="curve-mark" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <LinkFlow v-if="variant === 'link' && motion === 'loop' && !$slots.default" />
    <svg v-else ref="root" viewBox="0 0 100 100" focusable="false">
      <g ref="group">
        <path
          :d="path"
          fill="none"
          stroke="currentColor"
          :stroke-width="$slots.default ? 3 : 6"
          opacity="0.22"
        />
        <g ref="trail">
          <circle
            v-for="i in count"
            :key="i"
            :cx="point((-i / count) * 0.36 * Math.PI * 2)[0]"
            :cy="point((-i / count) * 0.36 * Math.PI * 2)[1]"
            :r="0.9 + 4.3 * (1 - i / count)"
            :opacity="0.08 + 0.92 * (1 - i / count) ** 0.65"
            fill="currentColor"
          />
        </g>
      </g>
    </svg>
    <span v-if="$slots.default" class="curve-mark__symbol"><slot /></span>
  </span>
</template>

<style scoped>
.curve-mark {
  position: relative;
  display: inline-grid;
  vertical-align: middle;
  flex: none;
  color: color-mix(in srgb, var(--text, #edf2fa) 86%, var(--accent, #7caaff));
}
.curve-mark > svg {
  display: block;
  width: 100%;
  height: 100%;
}
.curve-mark__symbol {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}
</style>
