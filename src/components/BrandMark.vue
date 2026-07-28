<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    size?: number
    transitionName?: string
  }>(),
  {
    label: 'PanguPay',
    size: 32,
    transitionName: '',
  },
)
</script>

<template>
  <span
    class="brand-mark"
    role="img"
    :aria-label="label"
    :style="{
      '--brand-size': `${size}px`,
      viewTransitionName: transitionName || undefined,
    }"
  >
    <span class="brand-mark__shape" aria-hidden="true" />
  </span>
</template>

<style scoped>
.brand-mark {
  display: inline-grid;
  width: var(--brand-size);
  height: var(--brand-size);
  flex: none;
  place-items: center;
  color: currentColor;
}

.brand-mark__shape {
  width: 100%;
  height: 100%;
  background: currentColor;
  mask: url('/brand-mark-mask.png') center / contain no-repeat;
  -webkit-mask: url('/brand-mark-mask.png') center / contain no-repeat;
}
</style>
