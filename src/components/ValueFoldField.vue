<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

import BrandMark from '@/components/BrandMark.vue'
import {
  buildFoldPath,
  FIELD_CENTER,
  GRID_POSITIONS,
  lineAppearance,
  lineBreath,
  type FoldAxis,
  type FoldPointer,
} from '@/components/valueFoldGeometry'

withDefaults(
  defineProps<{
    active?: boolean
    intro?: boolean
    label: string
    transitionName?: string
  }>(),
  {
    active: false,
    intro: true,
    transitionName: '',
  },
)

const field = ref<HTMLElement | null>(null)
const verticalLines: SVGPathElement[] = []
const horizontalLines: SVGPathElement[] = []
const lineAppearances = GRID_POSITIONS.map(lineAppearance)
const pointerTarget: FoldPointer = { x: FIELD_CENTER, y: FIELD_CENTER, influence: 0 }
const pointerCurrent: FoldPointer = { ...pointerTarget }

let animationFrame = 0
let animationStartedAt = 0
let lastFrameAt = 0
let lastPaintAt = 0
let fieldVisible = true
let reduceMotion = false
let finePointer = false
let visibilityObserver: IntersectionObserver | undefined
let motionQuery: MediaQueryList | undefined
let pointerQuery: MediaQueryList | undefined

function setLineRef(axis: FoldAxis, element: unknown, index: number): void {
  if (!(element instanceof SVGPathElement)) return
  ;(axis === 'vertical' ? verticalLines : horizontalLines)[index] = element
}

function renderPaths(elapsedMs: number, animated = false): void {
  const pointer = pointerCurrent.influence > 0.001 ? pointerCurrent : undefined
  GRID_POSITIONS.forEach((position, index) => {
    const breath = animated ? lineBreath(position, elapsedMs) : 0
    verticalLines[index]?.setAttribute('d', buildFoldPath('vertical', position, breath, pointer))
    horizontalLines[index]?.setAttribute(
      'd',
      buildFoldPath('horizontal', position, breath, pointer),
    )
  })
}

function setDepthProperties(): void {
  if (!field.value) return
  const x = ((pointerCurrent.x - FIELD_CENTER) / FIELD_CENTER) * pointerCurrent.influence
  const y = ((pointerCurrent.y - FIELD_CENTER) / FIELD_CENTER) * pointerCurrent.influence
  field.value.style.setProperty('--field-grid-x', `${(x * 3.5).toFixed(3)}px`)
  field.value.style.setProperty('--field-grid-y', `${(y * 3.5).toFixed(3)}px`)
  field.value.style.setProperty('--field-halo-x', `${(x * 2).toFixed(3)}px`)
  field.value.style.setProperty('--field-halo-y', `${(y * 2).toFixed(3)}px`)
  field.value.style.setProperty('--field-logo-x', `${(x * -1.25).toFixed(3)}px`)
  field.value.style.setProperty('--field-logo-y', `${(y * -1.25).toFixed(3)}px`)
  field.value.style.setProperty('--field-tilt-x', `${(x * 0.8).toFixed(3)}deg`)
  field.value.style.setProperty('--field-tilt-y', `${(y * -0.65).toFixed(3)}deg`)
}

function animate(now: number): void {
  animationFrame = 0
  if (reduceMotion || document.hidden || !fieldVisible) return

  animationStartedAt ||= now
  lastFrameAt ||= now
  const elapsedSeconds = Math.min((now - lastFrameAt) / 1000, 0.05)
  const positionSmoothing = 1 - Math.exp(-elapsedSeconds / 0.09)
  const influenceSmoothing =
    1 -
    Math.exp(-elapsedSeconds / (pointerTarget.influence > pointerCurrent.influence ? 0.09 : 0.28))
  pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * positionSmoothing
  pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * positionSmoothing
  pointerCurrent.influence +=
    (pointerTarget.influence - pointerCurrent.influence) * influenceSmoothing

  const frameInterval = finePointer ? 1000 / 45 : 1000 / 30
  if (now - lastPaintAt >= frameInterval) {
    renderPaths(now - animationStartedAt, true)
    setDepthProperties()
    lastPaintAt = now
  }
  lastFrameAt = now
  animationFrame = requestAnimationFrame(animate)
}

function startAnimation(): void {
  if (!animationFrame && !reduceMotion && !document.hidden && fieldVisible) {
    lastFrameAt = performance.now()
    animationFrame = requestAnimationFrame(animate)
  }
}

function stopAnimation(): void {
  cancelAnimationFrame(animationFrame)
  animationFrame = 0
}

function handlePointerMove(event: PointerEvent): void {
  if (!finePointer || reduceMotion || !field.value) return
  const bounds = field.value.getBoundingClientRect()
  pointerTarget.x = ((event.clientX - bounds.left) / bounds.width) * FIELD_CENTER * 2
  pointerTarget.y = ((event.clientY - bounds.top) / bounds.height) * FIELD_CENTER * 2
  pointerTarget.influence = 1
}

function resetPointer(): void {
  pointerTarget.x = FIELD_CENTER
  pointerTarget.y = FIELD_CENTER
  pointerTarget.influence = 0
}

function handleMotionPreference(): void {
  reduceMotion = motionQuery?.matches ?? false
  if (reduceMotion) {
    stopAnimation()
    resetPointer()
    Object.assign(pointerCurrent, pointerTarget)
    renderPaths(0)
    setDepthProperties()
  } else {
    startAnimation()
  }
}

function handleVisibility(): void {
  if (document.hidden) stopAnimation()
  else startAnimation()
}

function handlePointerCapability(): void {
  finePointer = pointerQuery?.matches ?? false
  if (!finePointer) resetPointer()
}

onMounted(() => {
  motionQuery = matchMedia('(prefers-reduced-motion: reduce)')
  pointerQuery = matchMedia('(hover: hover) and (pointer: fine)')
  finePointer = pointerQuery.matches
  motionQuery.addEventListener('change', handleMotionPreference)
  pointerQuery.addEventListener('change', handlePointerCapability)
  document.addEventListener('visibilitychange', handleVisibility)
  visibilityObserver = new IntersectionObserver(([entry]) => {
    fieldVisible = entry?.isIntersecting ?? true
    if (fieldVisible) startAnimation()
    else stopAnimation()
  })
  if (field.value) visibilityObserver.observe(field.value)
  renderPaths(0)
  handleMotionPreference()
})

onBeforeUnmount(() => {
  stopAnimation()
  visibilityObserver?.disconnect()
  motionQuery?.removeEventListener('change', handleMotionPreference)
  pointerQuery?.removeEventListener('change', handlePointerCapability)
  document.removeEventListener('visibilitychange', handleVisibility)
})
</script>

<template>
  <div
    ref="field"
    class="value-fold-field"
    :class="{ 'is-activated': active, 'value-fold-field--no-intro': !intro }"
    :style="transitionName ? { viewTransitionName: transitionName } : undefined"
    data-value-fold-field
    data-motion-engine="native-svg"
    data-pointer-effect="local-lens"
    :data-active="String(active)"
    role="img"
    :aria-label="label"
    @pointermove="handlePointerMove"
    @pointerleave="resetPointer"
  >
    <div class="value-fold-field__space" aria-hidden="true">
      <svg class="value-fold-field__art" viewBox="0 0 720 720" focusable="false">
        <defs>
          <radialGradient id="value-fold-field-depth" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="var(--field-highlight)" stop-opacity="0.1" />
            <stop offset="0.34" stop-color="var(--accent)" stop-opacity="0.055" />
            <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="value-fold-field-mask" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="white" />
            <stop offset="0.7" stop-color="white" stop-opacity="0.9" />
            <stop offset="1" stop-color="white" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="value-fold-field-wave" x1="28" y1="360" x2="356" y2="360">
            <stop offset="0" stop-color="var(--accent)" stop-opacity="0" />
            <stop offset="0.72" stop-color="var(--accent)" />
            <stop offset="1" stop-color="var(--field-highlight)" />
          </linearGradient>
          <mask id="value-fold-field-fade">
            <rect width="720" height="720" fill="url('#value-fold-field-mask')" />
          </mask>
          <filter
            id="value-fold-field-glow"
            x="-40%"
            y="-40%"
            width="180%"
            height="180%"
            color-interpolation-filters="sRGB"
          >
            <feGaussianBlur stdDeviation="4.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <circle
          class="value-fold-field__depth"
          cx="360"
          cy="360"
          r="286"
          fill="url('#value-fold-field-depth')"
        />

        <g class="value-fold-field__grid" mask="url('#value-fold-field-fade')">
          <g
            class="value-fold-field__grid-layer value-fold-field__grid-layer--vertical"
            data-grid-layer="vertical"
          >
            <path
              v-for="(position, index) in GRID_POSITIONS"
              :key="`vertical-${position}`"
              class="value-fold-field__grid-line"
              :class="{
                'value-fold-field__grid-line--axis': position === FIELD_CENTER,
                'value-fold-field__grid-line--outer': lineAppearances[index]!.blur > 0.24,
              }"
              :d="buildFoldPath('vertical', position, 0)"
              :ref="(element) => setLineRef('vertical', element, index)"
              :style="{
                '--line-opacity': lineAppearances[index]!.opacity,
                '--line-blur': `${lineAppearances[index]!.blur}px`,
                '--line-phase': `-${lineAppearances[index]!.phaseMs}ms`,
              }"
              data-grid-line
            />
          </g>
          <g
            class="value-fold-field__grid-layer value-fold-field__grid-layer--horizontal"
            data-grid-layer="horizontal"
          >
            <path
              v-for="(position, index) in GRID_POSITIONS"
              :key="`horizontal-${position}`"
              class="value-fold-field__grid-line"
              :class="{
                'value-fold-field__grid-line--axis': position === FIELD_CENTER,
                'value-fold-field__grid-line--outer': lineAppearances[index]!.blur > 0.24,
              }"
              :d="buildFoldPath('horizontal', position, 0)"
              :ref="(element) => setLineRef('horizontal', element, index)"
              :style="{
                '--line-opacity': lineAppearances[index]!.opacity,
                '--line-blur': `${lineAppearances[index]!.blur}px`,
                '--line-phase': `-${lineAppearances[index]!.phaseMs}ms`,
              }"
              data-grid-line
            />
          </g>
        </g>

        <path
          class="value-fold-field__wave"
          d="M 28 360 C 144 360 252 360 356 360"
          pathLength="100"
          data-field-wave
        />
      </svg>

      <div class="value-fold-field__logo" data-field-logo>
        <span class="value-fold-field__logo-light" />
        <BrandMark :size="80" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.value-fold-field {
  --field-highlight: color-mix(in srgb, var(--accent) 54%, white);
  --field-space-cloud: rgb(0 102 204 / 0.055);
  --field-grid-x: 0px;
  --field-grid-y: 0px;
  --field-halo-x: 0px;
  --field-halo-y: 0px;
  --field-logo-x: 0px;
  --field-logo-y: 0px;
  --field-tilt-x: 0deg;
  --field-tilt-y: 0deg;
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  isolation: isolate;
  perspective: 1100px;
}

:global(:root[data-theme='dark'] .value-fold-field) {
  --field-space-cloud: rgb(7 19 31 / 0.46);
}

.value-fold-field::before {
  position: absolute;
  inset: 9%;
  z-index: -1;
  border-radius: 42%;
  background:
    radial-gradient(circle at center, rgb(36 139 255 / 0.12), transparent 48%),
    radial-gradient(ellipse at center, var(--field-space-cloud), transparent 72%);
  content: '';
  filter: blur(24px);
  opacity: 0.9;
  transform: translate3d(var(--field-halo-x), var(--field-halo-y), 0);
}

.value-fold-field__space {
  position: absolute;
  inset: 0;
  transform-style: preserve-3d;
}

.value-fold-field__art {
  width: 100%;
  height: 100%;
  overflow: visible;
  transform: translate3d(var(--field-grid-x), var(--field-grid-y), 0) rotateX(var(--field-tilt-y))
    rotateY(var(--field-tilt-x));
  transform-origin: center;
  transform-style: preserve-3d;
  will-change: transform;
}

.value-fold-field__depth {
  transform-origin: 360px 360px;
  animation: value-fold-depth-enter 1.5s var(--ease-standard) both;
}

.value-fold-field__grid-layer {
  transform-origin: 360px 360px;
}

.value-fold-field__grid-layer--vertical {
  animation: value-fold-grid-enter 1.25s var(--ease-standard) both;
}

.value-fold-field__grid-layer--horizontal {
  animation: value-fold-grid-enter 1.25s var(--ease-standard) 80ms both;
}

.value-fold-field--no-intro .value-fold-field__depth,
.value-fold-field--no-intro .value-fold-field__grid-layer,
.value-fold-field--no-intro .value-fold-field__logo {
  animation: none;
}

.value-fold-field__grid-line {
  --line-opacity: 0.12;
  --line-blur: 0px;
  --line-phase: 0ms;
  fill: none;
  stroke: var(--accent);
  stroke-linecap: round;
  stroke-width: 0.82;
  opacity: var(--line-opacity);
  filter: blur(var(--line-blur));
  animation: value-fold-line-luminance 8.5s ease-in-out var(--line-phase) infinite;
  vector-effect: non-scaling-stroke;
}

.value-fold-field__grid-line--axis {
  stroke-width: 0.9;
}

.value-fold-field__wave {
  fill: none;
  stroke: url('#value-fold-field-wave');
  stroke-dasharray: 13 87;
  stroke-dashoffset: 100;
  stroke-linecap: round;
  stroke-width: 1.25;
  opacity: 0;
  filter: url('#value-fold-field-glow');
  vector-effect: non-scaling-stroke;
}

.value-fold-field.is-activated .value-fold-field__wave {
  animation: value-fold-wave-converge 760ms var(--ease-standard) both;
}

.value-fold-field__logo {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  width: 84px;
  aspect-ratio: 1;
  color: var(--text);
  place-items: center;
  transform: translate(-50%, -50%) translate3d(var(--field-logo-x), var(--field-logo-y), 32px);
  animation: value-fold-logo-enter 1.7s var(--ease-standard) both;
  will-change: transform;
}

.value-fold-field__logo :deep(.brand-mark) {
  width: 80px;
  height: 80px;
  filter: drop-shadow(0 8px 24px rgb(36 139 255 / 0.14));
}

.value-fold-field__logo-light {
  position: absolute;
  inset: -115%;
  z-index: -1;
  border-radius: 50%;
  background: radial-gradient(circle, rgb(114 184 255 / 0.15), transparent 64%);
  filter: blur(15px);
  animation: value-fold-logo-breathe 14s ease-in-out infinite;
}

.value-fold-field.is-activated .value-fold-field__logo-light {
  animation: value-fold-logo-response 760ms var(--ease-standard) both;
}

.value-fold-field.is-activated .value-fold-field__logo :deep(.brand-mark) {
  animation: value-fold-mark-response 760ms var(--ease-standard) both;
}

@keyframes value-fold-grid-enter {
  from {
    opacity: 0;
    transform: scale(1.035);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes value-fold-depth-enter {
  from {
    opacity: 0;
    transform: scale(1.12);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes value-fold-logo-enter {
  0%,
  42% {
    opacity: 0;
    filter: blur(7px);
  }

  100% {
    opacity: 1;
    filter: blur(0);
  }
}

@keyframes value-fold-line-luminance {
  0%,
  100% {
    opacity: calc(var(--line-opacity) * 0.72);
  }

  50% {
    opacity: var(--line-opacity);
  }
}

@keyframes value-fold-wave-converge {
  0% {
    stroke-dashoffset: 100;
    opacity: 0;
  }

  14% {
    opacity: 0.9;
  }

  82% {
    stroke-dashoffset: 13;
    opacity: 1;
  }

  100% {
    stroke-dashoffset: 0;
    opacity: 0;
  }
}

@keyframes value-fold-logo-response {
  0%,
  100% {
    opacity: 0.76;
    transform: scale(1);
  }

  62% {
    opacity: 1;
    transform: scale(1.08);
  }
}

@keyframes value-fold-logo-breathe {
  0%,
  100% {
    opacity: 0.68;
    transform: scale(0.98);
  }

  50% {
    opacity: 0.82;
    transform: scale(1.02);
  }
}

@keyframes value-fold-mark-response {
  0%,
  100% {
    transform: scale(1);
  }

  62% {
    transform: scale(1.035);
  }
}

@media (max-width: 599px) {
  .value-fold-field__logo,
  .value-fold-field__logo :deep(.brand-mark) {
    width: 64px;
    height: 64px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .value-fold-field__art {
    transform: none;
  }

  .value-fold-field__logo {
    transform: translate(-50%, -50%);
  }

  .value-fold-field__grid-layer,
  .value-fold-field__grid-line,
  .value-fold-field__depth,
  .value-fold-field__logo,
  .value-fold-field__logo :deep(.brand-mark),
  .value-fold-field__logo-light,
  .value-fold-field__wave {
    animation: none;
  }
}

@media (prefers-reduced-transparency: reduce) {
  .value-fold-field::before,
  .value-fold-field__logo-light {
    opacity: 0.38;
  }
}
</style>
