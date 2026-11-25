<script setup lang="ts">
import { PhCheck, PhCopy } from '@phosphor-icons/vue'
import { onBeforeUnmount, ref } from 'vue'
import { wt } from '@/i18n/walletText'

const props = defineProps<{ value: string; label: string; iconOnly?: boolean }>()
const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.value)
  } catch {
    return
  }
  copied.value = true
  clearTimeout(resetTimer)
  resetTimer = setTimeout(() => (copied.value = false), 1_500)
}

onBeforeUnmount(() => clearTimeout(resetTimer))
</script>

<template>
  <button
    type="button"
    :class="{ 'wallet-copy-button--icon': iconOnly }"
    :aria-label="wt('w370', [label])"
    :title="iconOnly ? (copied ? wt('w154') : wt('w370', [label])) : undefined"
    @click="copy"
  >
    <component :is="copied ? PhCheck : PhCopy" :size="15" aria-hidden="true" />
    <span :class="{ 'sr-only': iconOnly }" aria-live="polite">
      {{ copied ? wt('w154') : iconOnly ? '' : wt('refinement5') }}
    </span>
  </button>
</template>

<style scoped>
.wallet-copy-button--icon {
  display: inline-grid;
  inline-size: 36px;
  block-size: 36px;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.wallet-copy-button--icon:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.wallet-copy-button--icon:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}
</style>
