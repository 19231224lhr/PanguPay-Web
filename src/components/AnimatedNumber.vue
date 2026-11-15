<script setup lang="ts">
import { computed } from 'vue'
const props = defineProps<{ value?: string | number | null }>()
// Display exact incoming text. Never interpolate monetary values or invent intermediate counts.
const text = computed(() => (props.value == null ? '—' : String(props.value)))
const characters = computed(() =>
  Array.from(text.value).map((value, index) => ({
    value,
    position: text.value.length - index,
  })),
)
</script>

<template>
  <span class="animated-number">
    <span class="animated-number__accessible">{{ text }}</span>
    <span class="animated-number__visual" aria-hidden="true">
      <span
        v-for="character in characters"
        :key="character.position"
        class="animated-number__column"
      >
        <Transition name="stat-digit">
          <span :key="character.value" class="animated-number__digit">{{ character.value }}</span>
        </Transition>
      </span>
    </span>
  </span>
</template>

<style scoped>
.animated-number {
  display: inline-grid;
  vertical-align: baseline;
  font-variant-numeric: tabular-nums;
  white-space: pre;
}
.animated-number__accessible {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
.animated-number__visual {
  display: inline-flex;
}
.animated-number__column {
  display: inline-grid;
  position: relative;
  overflow: hidden;
}
.animated-number__digit {
  grid-area: 1 / 1;
}
.stat-digit-enter-active,
.stat-digit-leave-active {
  transition:
    transform 280ms var(--ease-standard),
    opacity 280ms var(--ease-standard);
}
.stat-digit-leave-active {
  position: absolute;
  inset: 0;
}
.stat-digit-enter-from {
  transform: translateY(65%);
  opacity: 0;
}
.stat-digit-leave-to {
  transform: translateY(-65%);
  opacity: 0;
}
@media (prefers-reduced-motion: reduce) {
  .stat-digit-enter-active,
  .stat-digit-leave-active {
    transition: none;
  }
  .stat-digit-enter-from,
  .stat-digit-leave-to {
    transform: none;
  }
}
</style>
