<script setup lang="ts">
import {
  PhArrowDownLeft,
  PhArrowRight,
  PhClockCounterClockwise,
  PhPaperPlaneTilt,
  PhShieldCheck,
  PhSquaresFour,
} from '@phosphor-icons/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppButton from './AppButton.vue'

const props = defineProps<{ overview: HTMLElement }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const guide = ref<HTMLElement>()
const next = ref<{ $el: HTMLButtonElement }>()
const steps = [
  { id: 'receive', target: '[data-card="addresses-preview"]', icon: PhArrowDownLeft },
  { id: 'send', target: '[data-card="balance"]', icon: PhPaperPlaneTilt },
  { id: 'activity', target: '[data-card="activity"]', icon: PhClockCounterClockwise },
  { id: 'security', target: '[data-card="security"]', icon: PhShieldCheck },
  { id: 'layout', target: '[data-account-trigger]', icon: PhSquaresFour },
] as const
const index = ref(0)
const step = computed(() => steps[index.value]!)
const isLast = computed(() => index.value === steps.length - 1)
let target: HTMLElement | undefined
let placementFrame = 0
let observer: ResizeObserver | undefined
const compact = matchMedia('(max-width: 767px)')
type BubblePlacement = {
  x: number
  y: number
  pointer?: 'left' | 'right' | 'top' | 'bottom'
  tip?: number
}
const placement = ref<BubblePlacement>()

function placeBubble(): void {
  if (!guide.value || !target) return
  const anchor = target.getBoundingClientRect()
  const { offsetWidth: width, offsetHeight: height } = guide.value
  const viewportWidth = document.documentElement.clientWidth
  const viewportHeight = document.documentElement.clientHeight
  const margin = 12
  const gap = 16
  const minX =
    compact.matches || step.value.id === 'layout'
      ? margin
      : Math.max(margin, props.overview.getBoundingClientRect().left)
  const maxX = viewportWidth - width - margin
  const minY = margin
  const maxY = Math.max(minY, viewportHeight - height - (compact.matches ? 78 : margin))
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max))
  const centerX = (anchor.left + anchor.right) / 2
  const centerY = (anchor.top + anchor.bottom) / 2
  const detail = target.querySelector(step.value.id === 'send' ? '[data-send-trigger]' : 'h2')
  const aim = detail?.getBoundingClientRect() ?? anchor
  const aimX = (aim.left + aim.right) / 2
  const aimY = (aim.top + aim.bottom) / 2
  const inset = 22
  const x = clamp(clamp(centerX - width / 2, aimX - width + inset, aimX - inset), minX, maxX)
  const y = clamp(clamp(centerY - height / 2, aimY - height + inset, aimY - inset), minY, maxY)
  const visible = anchor.bottom > minY && anchor.top < viewportHeight
  const vertical: BubblePlacement[] = [
    { x, y: anchor.bottom + gap, pointer: 'top', tip: aimX - x },
    { x, y: anchor.top - gap - height, pointer: 'bottom', tip: aimX - x },
  ]
  const horizontal: BubblePlacement[] = [
    { x: anchor.right + gap, y, pointer: 'left', tip: aimY - y },
    { x: anchor.left - gap - width, y, pointer: 'right', tip: aimY - y },
  ]
  const candidates = compact.matches ? vertical : [...horizontal, ...vertical]
  const fits = ({ x, y }: BubblePlacement) => x >= minX && x <= maxX && y >= minY && y <= maxY
  const aligns = ({ pointer, tip }: BubblePlacement) => {
    const span = pointer === 'top' || pointer === 'bottom' ? width : height
    return tip !== undefined && tip >= inset - 0.5 && tip <= span - inset + 0.5
  }
  const pointed = visible && candidates.find((position) => fits(position) && aligns(position))
  if (pointed) {
    placement.value = pointed
    return
  }
  const fit = visible && candidates.find(fits)
  placement.value = fit
    ? { x: fit.x, y: fit.y }
    : { x, y: visible ? clamp(anchor.bottom + gap, minY, maxY) : maxY }
}

function schedulePlacement(): void {
  if (placementFrame) return
  placementFrame = requestAnimationFrame(() => {
    placementFrame = 0
    placeBubble()
  })
}

function highlight(): void {
  const account = step.value.id === 'layout'
  const candidates = (account ? document : props.overview).querySelectorAll<HTMLElement>(
    step.value.target,
  )
  const visible = Array.from(candidates).find((element) => {
    const bounds = element.getBoundingClientRect()
    return bounds.width > 0 && (!account || (bounds.bottom > 0 && bounds.top < innerHeight))
  })
  if (visible !== target) {
    if (target) observer?.unobserve(target)
    target?.removeAttribute('data-welcome-highlight')
    visible?.setAttribute('data-welcome-highlight', '')
    target = visible
    if (target) observer?.observe(target)
  }
  schedulePlacement()
  if (account || !target) return
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({
    block: compact.matches ? 'center' : 'nearest',
    behavior: reduced ? 'instant' : 'smooth',
  })
}

function close(): void {
  if (guide.value?.contains(document.activeElement)) props.overview.focus({ preventScroll: true })
  emit('close')
}

function previous(event: MouseEvent): void {
  index.value--
  if (index.value === 0 && event.detail === 0) next.value?.$el.focus()
}

onMounted(() => {
  observer = new ResizeObserver(schedulePlacement)
  if (guide.value) observer.observe(guide.value)
  observer.observe(props.overview)
  highlight()
  window.addEventListener('scroll', schedulePlacement, { capture: true, passive: true })
  window.addEventListener('resize', schedulePlacement)
  compact.addEventListener('change', highlight)
})
watch(index, highlight, { flush: 'post' })
onUnmounted(() => {
  target?.removeAttribute('data-welcome-highlight')
  observer?.disconnect()
  cancelAnimationFrame(placementFrame)
  window.removeEventListener('scroll', schedulePlacement, true)
  window.removeEventListener('resize', schedulePlacement)
  compact.removeEventListener('change', highlight)
})
</script>

<template>
  <section
    ref="guide"
    class="wallet-welcome"
    :data-pointer="placement?.pointer"
    :style="
      placement
        ? {
            left: placement.x + 'px',
            top: placement.y + 'px',
            '--guide-tip': (placement.tip ?? 0) + 'px',
          }
        : { visibility: 'hidden' }
    "
    :aria-label="t('welcomeGuide.label')"
    @keydown.esc.stop="close"
  >
    <div class="wallet-welcome__top">
      <span>{{ t('welcomeGuide.label') }}</span>
      <span :aria-label="t('welcomeGuide.progress', { current: index + 1, total: steps.length })">
        {{ index + 1 }} / {{ steps.length }}
      </span>
    </div>
    <div class="wallet-welcome__progress" aria-hidden="true">
      <span
        v-for="position in steps.length"
        :key="position"
        :class="{ 'is-reached': position <= index + 1 }"
      />
    </div>
    <div aria-live="polite" aria-atomic="true">
      <Transition name="welcome-content">
        <div :key="step.id" class="wallet-welcome__content">
          <span class="wallet-welcome__symbol" aria-hidden="true">
            <component :is="step.icon" :size="21" />
          </span>
          <div>
            <h2>{{ t(`welcomeGuide.${step.id}.title`) }}</h2>
            <p>{{ t(`welcomeGuide.${step.id}.body`) }}</p>
          </div>
        </div>
      </Transition>
    </div>
    <div class="wallet-welcome__actions">
      <AppButton variant="ghost" @click="close">{{ t('welcomeGuide.skip') }}</AppButton>
      <AppButton v-if="index > 0" variant="ghost" @click="previous">
        {{ t('welcomeGuide.back') }}
      </AppButton>
      <AppButton ref="next" @click="isLast ? close() : index++">
        {{ t(isLast ? 'welcomeGuide.done' : 'welcomeGuide.next') }}
        <PhArrowRight v-if="!isLast" :size="16" aria-hidden="true" />
      </AppButton>
    </div>
  </section>
</template>

<style scoped>
.wallet-welcome {
  --guide-surface: color-mix(in srgb, var(--surface-raised) 91%, var(--accent));
  --guide-border: color-mix(in srgb, var(--accent) 58%, var(--border-strong));
  position: fixed;
  z-index: 32;
  width: min(358px, calc(100% - 24px));
  padding: 16px;
  border: 1px solid var(--guide-border);
  border-radius: var(--radius-lg);
  background: var(--guide-surface);
  color: var(--text);
  box-shadow: 0 8px 28px rgb(0 0 0 / 0.22);
  animation: welcome-appear 240ms var(--ease-standard) both;
}

.wallet-welcome__top > span:first-child {
  color: var(--accent);
}

.wallet-welcome[data-pointer]::before {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  background: var(--guide-surface);
  border-block-start: 1px solid var(--guide-border);
  border-inline-start: 1px solid var(--guide-border);
  transform: translate(-50%, -50%) rotate(var(--guide-tip-turn));
  pointer-events: none;
}

.wallet-welcome[data-pointer='top']::before {
  top: 0;
  left: var(--guide-tip);
  --guide-tip-turn: 45deg;
}
.wallet-welcome[data-pointer='bottom']::before {
  top: 100%;
  left: var(--guide-tip);
  --guide-tip-turn: 225deg;
}
.wallet-welcome[data-pointer='left']::before {
  top: var(--guide-tip);
  left: 0;
  --guide-tip-turn: -45deg;
}
.wallet-welcome[data-pointer='right']::before {
  top: var(--guide-tip);
  left: 100%;
  --guide-tip-turn: 135deg;
}

.wallet-welcome__top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--text-muted);
  font-size: 0.75rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.wallet-welcome__progress {
  display: flex;
  gap: 4px;
  margin-block: 8px 15px;
}

.wallet-welcome__progress span {
  flex: 1;
  height: 3px;
  border-radius: 4px;
  background: var(--border-strong);
  transition: background 180ms ease;
}

.wallet-welcome__progress .is-reached {
  background: var(--accent);
}

.wallet-welcome__content {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 12px;
}

.wallet-welcome__symbol {
  display: grid;
  width: 38px;
  height: 38px;
  place-items: center;
  border-radius: var(--radius-sm);
  background: var(--wallet-selection-fill, var(--surface-subtle));
  color: var(--accent);
}

h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 650;
  line-height: 1.3;
}
p {
  margin: 5px 0 0;
  color: var(--text-muted);
  font-size: 0.83rem;
  line-height: 1.55;
}

.wallet-welcome__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  margin-top: 14px;
}

.wallet-welcome__actions > :first-child {
  margin-inline-end: auto;
}
.wallet-welcome__actions :deep(.app-button) {
  min-height: 40px;
  padding-inline: 10px;
}

:global([data-welcome-highlight]) {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

:global([data-card][data-welcome-highlight]) {
  scroll-margin-block: 16px 72px;
}

.welcome-content-enter-active {
  animation: welcome-appear 190ms var(--ease-standard) both;
}
.welcome-content-leave-active {
  display: none;
}
@keyframes welcome-appear {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet-welcome,
  .welcome-content-enter-active {
    animation: none;
  }
  .wallet-welcome__progress span {
    transition: none;
  }
}
</style>
