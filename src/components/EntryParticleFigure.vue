<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import { createParticleScene, type EntryShape } from '@/graphics/entryParticles'
import type { UnlockPhase } from '@/composables/useEntryUnlock'
const props = withDefaults(defineProps<{ shape: EntryShape; phase?: UnlockPhase }>(), {
  phase: 'idle',
})
const canvas = ref<HTMLCanvasElement>()
let scene: ReturnType<typeof createParticleScene> | undefined
onMounted(() => {
  if (canvas.value) scene = createParticleScene(canvas.value, props.shape)
})
watch(
  () => props.shape,
  (shape) => {
    if (props.phase === 'idle') scene?.setShape(shape)
  },
)
watch(
  () => props.phase,
  (phase) => {
    scene?.setPhase(phase)
    if (phase === 'idle') scene?.setShape(props.shape)
  },
)
onBeforeUnmount(() => scene?.destroy())
</script>
<template>
  <canvas ref="canvas" class="entry-particles" :data-shape="shape" aria-hidden="true" />
</template>
<style scoped>
.entry-particles {
  display: block;
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  pointer-events: none;
  touch-action: pan-y;
}
</style>
