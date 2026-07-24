<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    active?: boolean
    disabled?: boolean
  }>(),
  {
    active: false,
    disabled: false,
  },
)
</script>

<template>
  <button
    class="icon-button"
    :class="{ 'icon-button--active': active }"
    type="button"
    :aria-label="label"
    :title="label"
    :disabled="disabled"
  >
    <slot />
  </button>
</template>

<style scoped>
.icon-button {
  display: inline-grid;
  width: 44px;
  height: 44px;
  flex: none;
  place-items: center;
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--overlay);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    transform var(--duration-press) var(--ease-press);
}

.icon-button:hover,
.icon-button--active {
  background: var(--surface-raised);
  color: var(--text);
}

.icon-button:active {
  transform: scale(0.93);
}
</style>
