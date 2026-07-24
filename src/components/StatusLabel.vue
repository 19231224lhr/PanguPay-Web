<script setup lang="ts">
withDefaults(
  defineProps<{
    tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'accent'
  }>(),
  { tone: 'neutral' },
)
</script>

<template>
  <span class="status-label" :class="`status-label--${tone}`">
    <span class="status-label__dot" aria-hidden="true" />
    <slot />
  </span>
</template>

<style scoped>
.status-label {
  --status-color: var(--text-muted);
  display: inline-flex;
  min-height: 30px;
  align-items: center;
  gap: 0.48rem;
  padding: 0.28rem 0.66rem;
  border: 1px solid color-mix(in srgb, var(--status-color) 24%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--status-color) 8%, transparent);
  color: var(--text);
  font-size: 0.75rem;
  font-weight: 620;
  white-space: nowrap;
}

.status-label__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-color);
}

.status-label--success {
  --status-color: var(--success);
}

.status-label--warning {
  --status-color: var(--warning);
}

.status-label--danger {
  --status-color: var(--danger);
}

.status-label--accent {
  --status-color: var(--accent);
}
</style>
