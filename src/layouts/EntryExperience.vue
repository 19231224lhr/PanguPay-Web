<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EntryParticleFigure from '@/components/EntryParticleFigure.vue'
import { entryFigureKey } from '@/composables/useEntryFigure'
import type { EntryShape } from '@/graphics/entryParticles'
import { desktopEntryFrame } from '@/graphics/entryFigureFrame'
import { unlockPhase } from '@/composables/useEntryUnlock'
withDefaults(defineProps<{ active?: boolean }>(), { active: true })
const route = useRoute()
const override = ref<EntryShape>()
const root = ref<HTMLElement>()
const frame = ref({
  position: 'absolute' as 'absolute' | 'fixed',
  left: '0px',
  top: '0px',
  width: '0px',
  height: '0px',
})
provide(entryFigureKey, override)
watch(
  () => route.path,
  () => {
    override.value = undefined
  },
  { flush: 'sync' },
)
const shape = computed<EntryShape>(
  () =>
    override.value ??
    (
      {
        'wallet-setup': 'create',
        'wallet-unlock': 'key',
        'wallet-recover': 'import',
        'wallet-entry': 'shield',
      } as Record<string, EntryShape>
    )[String(route.name)] ??
    'wallet',
)
let observer: ResizeObserver | undefined
function measure() {
  // Desktop routes share the landing camera. Form geometry must never resize it.
  if (window.innerWidth >= 1024) {
    const rem = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
    const box = desktopEntryFrame(window.innerWidth, window.innerHeight, rem)
    frame.value = {
      position: 'fixed',
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.size}px`,
      height: `${box.size}px`,
    }
    return
  }
  const anchor = root.value?.querySelector<HTMLElement>('[data-entry-figure-anchor]')
  if (!anchor || !root.value) return
  const box = anchor.getBoundingClientRect(),
    container = root.value.getBoundingClientRect()
  frame.value = {
    position: 'absolute',
    left: `${box.left - container.left}px`,
    top: `${box.top - container.top}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  }
}
async function observeAnchor() {
  await nextTick()
  observer?.disconnect()
  const anchor = root.value?.querySelector<HTMLElement>('[data-entry-figure-anchor]')
  if (anchor) observer?.observe(anchor)
  if (root.value) observer?.observe(root.value)
  measure()
}
watch(() => route.path, observeAnchor, { flush: 'post' })
onMounted(() => {
  observer = new ResizeObserver(measure)
  void observeAnchor()
  window.addEventListener('resize', measure)
})
onBeforeUnmount(() => {
  observer?.disconnect()
  window.removeEventListener('resize', measure)
})
</script>
<template>
  <div
    ref="root"
    class="entry-experience"
    :class="`entry-experience--${unlockPhase}`"
    :data-entry-experience="active ? '' : undefined"
  >
    <div v-if="active" class="entry-experience__backdrop" aria-hidden="true" />
    <div class="entry-experience__content" :inert="unlockPhase !== 'idle'"><slot /></div>
    <div v-if="active" class="entry-experience__figure" :style="frame">
      <EntryParticleFigure :shape="shape" :phase="unlockPhase" />
    </div>
  </div>
</template>
<style scoped>
.entry-experience {
  position: relative;
  isolation: isolate;
  background: var(--background);
}
.entry-experience__backdrop {
  position: fixed;
  inset: 0;
  z-index: -1;
  overflow: hidden;
  pointer-events: none;
}
.entry-experience__backdrop::before {
  position: absolute;
  top: -20%;
  right: -10%;
  width: 68vw;
  height: 68vw;
  border-radius: 50%;
  background: radial-gradient(circle, var(--hero-halo), transparent 66%);
  content: '';
  filter: blur(18px);
}
.entry-experience__figure {
  position: absolute;
  overflow: visible;
  pointer-events: none;
  z-index: 1;
  color: var(--text);
}
.entry-experience__figure :deep(canvas) {
  pointer-events: auto;
}
.entry-experience__content {
  transition: opacity 300ms ease;
}
.entry-experience--loading .entry-experience__content {
  opacity: 0.6;
}
.entry-experience--arriving .entry-experience__content {
  opacity: 0;
  transition: none;
}
.entry-experience--revealing .entry-experience__content {
  opacity: 1;
  transition: opacity 1100ms cubic-bezier(0.22, 1, 0.36, 1);
}
.entry-experience--arriving .entry-experience__backdrop,
.entry-experience--revealing .entry-experience__backdrop {
  z-index: 2;
  background: var(--background);
}
.entry-experience--revealing .entry-experience__backdrop {
  opacity: 0;
  transition: opacity 1100ms cubic-bezier(0.4, 0, 0.2, 1);
}
.entry-experience--arriving .entry-experience__figure,
.entry-experience--revealing .entry-experience__figure {
  z-index: 3;
}
.entry-experience:not(.entry-experience--idle) .entry-experience__figure :deep(canvas) {
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .entry-experience__content,
  .entry-experience__backdrop {
    transition-duration: 180ms !important;
  }
}
</style>
