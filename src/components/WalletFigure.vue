<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { drawer, settle, stack, branches, phone, format, type Figure } from '@lucasmarkes/hairline'

const props = withDefaults(
  defineProps<{
    kind: 'drawer' | 'settle' | 'stack' | 'branches' | 'phone' | 'format'
    intensity?: number
  }>(),
  {
    intensity: 0.35,
  },
)
const host = ref<HTMLElement>()
let figure: Figure | undefined

function mountFigure() {
  figure?.destroy()
  if (!host.value) return
  figure = { drawer, settle, stack, branches, phone, format }[props.kind](host.value, {
    intensity: props.intensity,
    play: false,
  })
}
onMounted(mountFigure)
watch(() => props.kind, mountFigure)
watch(
  () => props.intensity,
  (intensity) => figure?.update({ intensity }),
)
onBeforeUnmount(() => figure?.destroy())
</script>

<template>
  <div ref="host" class="wallet-figure" :data-figure="kind" aria-hidden="true" />
</template>

<style scoped>
.wallet-figure {
  width: 112px;
  aspect-ratio: 5 / 4;
  flex-shrink: 0;
  --hairline-plate: var(--figure-plate, var(--background));
  --hairline-hi: var(--text);
  --hairline-edge: var(--text-muted);
  --hairline-mid: var(--text-faint);
  --hairline-lo: var(--border);
  --hairline-stroke: 0.85;
}
@media (prefers-reduced-motion: reduce), (hover: none) {
  .wallet-figure {
    pointer-events: none;
  }
}
</style>
