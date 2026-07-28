<script setup lang="ts">
import { RouterLink } from 'vue-router'

withDefaults(
  defineProps<{
    disabled?: boolean
    loading?: boolean
    size?: 'regular' | 'large'
    to?: string
    type?: 'button' | 'submit' | 'reset'
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  }>(),
  {
    disabled: false,
    loading: false,
    size: 'regular',
    to: undefined,
    type: 'button',
    variant: 'primary',
  },
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
    :disabled="disabled || loading"
    :aria-busy="loading ? 'true' : undefined"
  >
    <span v-if="loading" class="app-button__spinner" aria-hidden="true" />
    <span class="app-button__content"><slot /></span>
    <slot v-if="!loading" name="icon" />
  </button>
</template>

<style scoped>
.app-button {
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

.app-button__spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: spinner 0.72s linear infinite;
}
</style>
