<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    size?: number
  }>(),
  {
    label: 'PanguPay',
    size: 32,
  },
)
</script>

<template>
  <span class="brand-mark" role="img" :aria-label="label">
    <svg aria-hidden="true" viewBox="0 0 64 64" :width="size" :height="size">
      <path d="M32 32C19.5 26.1 19.1 11.8 32 7.8C44.9 11.8 44.5 26.1 32 32Z" />
      <path
        d="M32 32C19.5 26.1 19.1 11.8 32 7.8C44.9 11.8 44.5 26.1 32 32Z"
        transform="rotate(90 32 32)"
      />
      <path
        d="M32 32C19.5 26.1 19.1 11.8 32 7.8C44.9 11.8 44.5 26.1 32 32Z"
        transform="rotate(180 32 32)"
      />
      <path
        d="M32 32C19.5 26.1 19.1 11.8 32 7.8C44.9 11.8 44.5 26.1 32 32Z"
        transform="rotate(270 32 32)"
      />
    </svg>
  </span>
</template>

<style scoped>
.brand-mark {
  display: inline-grid;
  flex: none;
  place-items: center;
  color: currentColor;
}

svg {
  width: v-bind('`${size}px`');
  height: v-bind('`${size}px`');
  overflow: visible;
}

path {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 3.25;
}
</style>
