<script setup lang="ts">
import { computed, inject } from 'vue'
import { PhCheck, PhWarning, PhSpinnerGap } from '@phosphor-icons/vue'
import { RouterLink } from 'vue-router'

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    loading?: boolean
    status?: 'idle' | 'loading' | 'success' | 'error'
    loadingLabel?: string
    successLabel?: string
    errorLabel?: string
    size?: 'regular' | 'large'
    to?: string
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  }>(),
  {
    disabled: false,
    loading: false,
    status: 'idle',
    loadingLabel: undefined,
    successLabel: undefined,
    errorLabel: undefined,
    size: 'regular',
    to: undefined,
    type: 'button',
    variant: 'primary',
  },
)
const labels = inject(
  'motionLabels',
  computed(() => ({ loading: '处理中', success: '已完成', error: '请重试' })),
)
const activeState = computed(() => (props.loading ? 'loading' : props.status))
const busy = computed(() => activeState.value === 'loading')
const feedback = computed(() =>
  activeState.value === 'loading'
    ? (props.loadingLabel ?? labels.value.loading)
    : activeState.value === 'success'
      ? (props.successLabel ?? labels.value.success)
      : (props.errorLabel ?? labels.value.error),
)
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`]"
  >
    <span class="app-button__content"><slot /></span>
    <slot name="icon" />
  </RouterLink>
  <button
    v-else
    class="app-button"
    :class="[`app-button--${variant}`, `app-button--${size}`]"
    :type="type"
    :disabled="disabled || busy"
    :data-state="activeState"
    :aria-busy="busy ? 'true' : undefined"
  >
    <span
      class="app-button__rest"
      :class="{ 'is-concealed': activeState !== 'idle' }"
      :aria-hidden="activeState !== 'idle' || undefined"
    >
      <span class="app-button__content"><slot /></span><slot name="icon" />
    </span>
    <Transition name="button-feedback">
      <span
        v-if="activeState !== 'idle'"
        :key="activeState"
        class="app-button__feedback"
        role="status"
      >
        <PhSpinnerGap v-if="busy" class="app-button__spinner" :size="16" aria-hidden="true" />
        <PhCheck v-else-if="activeState === 'success'" :size="16" aria-hidden="true" />
        <PhWarning v-else :size="16" aria-hidden="true" />
        <span>{{ feedback }}</span>
      </span>
    </Transition>
  </button>
</template>

<style scoped>
.app-button {
  position: relative;
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  padding: 0.68rem 1.05rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: 0.92rem;
  font-weight: 650;
  letter-spacing: -0.012em;
  transition:
    background var(--duration-state) var(--ease-standard),
    border-color var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard),
    transform var(--duration-press) var(--ease-press);
}

.app-button:active:not(:disabled) {
  transform: scale(0.975);
}

.app-button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.app-button--large {
  min-height: 50px;
  padding-inline: 1.3rem;
  border-radius: 15px;
}

.app-button--primary {
  background: var(--action-primary);
  color: white;
}

.app-button--secondary {
  border-color: var(--border-strong);
  background: var(--surface-raised);
  color: var(--text);
}

.app-button--ghost {
  background: transparent;
  color: var(--text-muted);
}

.app-button--danger {
  background: color-mix(in srgb, var(--danger) 12%, var(--surface));
  color: var(--danger);
}

.app-button__content {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  line-height: 1;
  white-space: nowrap;
}

@media (hover: hover) and (pointer: fine) {
  .app-button:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  .app-button--primary:hover:not(:disabled) {
    background: var(--action-primary-hover);
  }

  .app-button--secondary:hover:not(:disabled) {
    border-color: var(--accent);
  }

  .app-button--ghost:hover:not(:disabled) {
    background: var(--surface-subtle);
    color: var(--text);
  }

  .app-button--danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--danger) 17%, var(--surface));
  }
}

.app-button__rest {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
}
.app-button__rest.is-concealed {
  visibility: hidden;
}
.app-button__feedback {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  font-size: 0.85em;
  pointer-events: none;
}
.app-button[data-state='loading']:disabled {
  opacity: 0.85;
}
.app-button[data-state='success'] {
  color: var(--accent);
}
.app-button--primary[data-state='success'] {
  color: white;
}
.app-button[data-state='error'] {
  color: var(--danger);
}
.app-button__spinner {
  animation: button-spin 900ms linear infinite;
}
@keyframes button-spin {
  to {
    transform: rotate(360deg);
  }
}
.button-feedback-enter-active,
.button-feedback-leave-active {
  transition:
    opacity var(--duration-state) var(--ease-standard),
    transform var(--duration-state) var(--ease-standard);
}
.button-feedback-enter-from {
  opacity: 0;
  transform: translateY(4px);
}
.button-feedback-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@media (prefers-reduced-motion: reduce) {
  .app-button {
    transition: none;
    transform: none !important;
  }
  .app-button__spinner {
    animation: none;
  }
  .button-feedback-enter-active,
  .button-feedback-leave-active {
    transition: none;
  }
  .button-feedback-enter-from,
  .button-feedback-leave-to {
    transform: none;
  }
}
</style>
