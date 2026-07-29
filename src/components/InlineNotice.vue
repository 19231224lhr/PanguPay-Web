<script setup lang="ts">
import { PhInfo as Info, PhWarningCircle as WarningCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    actionLabel?: string
    title: string
    tone?: 'info' | 'warning' | 'danger'
  }>(),
  { tone: 'info' },
)

const emit = defineEmits<{ action: [] }>()

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
    <button v-if="actionLabel" class="inline-notice__action" type="button" @click="emit('action')">
      {{ actionLabel }}
    </button>
  </aside>
</template>

<style scoped>
.inline-notice {
  --notice-color: var(--accent);
  --notice-mix: 8%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.72rem;
  min-height: 68px;
  padding: 0.72rem 0.78rem;
  border: 1px solid color-mix(in srgb, var(--notice-color) 13%, var(--hairline));
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--notice-color) var(--notice-mix), var(--surface));
  color: var(--text-muted);
  animation: inline-notice-enter var(--duration-state) var(--ease-standard) both;
}

.inline-notice--warning {
  --notice-color: var(--warning);
  --notice-mix: 4%;
}

.inline-notice--danger {
  --notice-color: var(--danger);
  --notice-mix: 4%;
}

.inline-notice__icon {
  box-sizing: content-box;
  padding: 0.42rem;
  border-radius: 50%;
  background: color-mix(in srgb, var(--notice-color) 10%, transparent);
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

.inline-notice__action {
  min-height: 44px;
  padding-inline: 0.78rem;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--notice-color);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
  white-space: nowrap;
  transition:
    background var(--duration-state) var(--ease-standard),
    transform var(--duration-press) var(--ease-press);
}

.inline-notice__action:hover {
  background: color-mix(in srgb, var(--notice-color) 9%, transparent);
}

.inline-notice__action:active {
  transform: scale(0.98);
}

.inline-notice__action:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 2px;
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

@media (max-width: 520px) {
  .inline-notice {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .inline-notice__action {
    grid-column: 2;
    justify-self: start;
    margin-left: -0.78rem;
  }
}
</style>
