<script setup lang="ts">
import { PhInfo as Info, PhWarningCircle as WarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    tone?: 'info' | 'warning' | 'danger'
  }>(),
  { tone: 'info' },
)

const role = computed(() => (props.tone === 'danger' ? 'alert' : 'status'))
const icon = computed(() => (props.tone === 'info' ? Info : WarningCircle))
</script>

<template>
  <aside class="inline-notice" :class="`inline-notice--${tone}`" :role="role">
    <component :is="icon" class="inline-notice__icon" :size="19" weight="regular" />
    <div class="inline-notice__content">
      <strong class="inline-notice__title">{{ title }}</strong>
      <div class="inline-notice__body"><slot /></div>
    </div>
  </aside>
</template>

<style scoped>
.inline-notice {
  --notice-color: var(--accent);
  --notice-mix: 8%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.86rem 0.95rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--notice-color) var(--notice-mix), var(--surface-subtle));
  color: var(--text-muted);
  animation: inline-notice-enter var(--duration-state) var(--ease-standard) both;
}

.inline-notice--warning {
  --notice-color: var(--warning);
  --notice-mix: 9%;
}

.inline-notice--danger {
  --notice-color: var(--danger);
  --notice-mix: 9%;
}

.inline-notice__icon {
  margin-top: 0.08rem;
  color: var(--notice-color);
}

.inline-notice__content {
  display: grid;
  gap: 0.18rem;
}

.inline-notice__title {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 660;
  letter-spacing: -0.012em;
}

.inline-notice__body {
  font-size: 0.78rem;
  line-height: 1.55;
}

@keyframes inline-notice-enter {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .inline-notice {
    animation: none;
  }
}
</style>
