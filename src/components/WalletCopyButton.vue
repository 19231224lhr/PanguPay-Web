<script setup lang="ts">
import { PhCheck, PhCopy } from '@phosphor-icons/vue'
import { onBeforeUnmount, ref } from 'vue'
import { wt } from '@/i18n/walletText'

const props = defineProps<{ value: string; label: string }>()
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
  <button type="button" :aria-label="wt('w370', [label])" @click="copy">
    <component :is="copied ? PhCheck : PhCopy" :size="15" aria-hidden="true" />
    <span aria-live="polite">{{ copied ? wt('w154') : wt('refinement5') }}</span>
  </button>
</template>
