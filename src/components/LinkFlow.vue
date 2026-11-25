<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { mountLinkFlow } from '@/graphics/linkFlow'
const svg = ref<SVGSVGElement>()
let stop: (() => void) | undefined
onMounted(() => { if (svg.value) stop = mountLinkFlow(svg.value) })
onBeforeUnmount(() => stop?.())
</script>
<template>
  <svg ref="svg" viewBox="0 0 100 100" focusable="false" aria-hidden="true" />
</template>
