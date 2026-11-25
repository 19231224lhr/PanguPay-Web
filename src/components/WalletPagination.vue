<script setup lang="ts">
import { PhCaretLeft, PhCaretRight } from '@phosphor-icons/vue'

import AppButton from '@/components/AppButton.vue'
import { wt } from '@/i18n/walletText'

defineProps<{ pageCount: number; label: string; disabled?: boolean }>()
const page = defineModel<number>({ required: true })
</script>

<template>
  <nav v-if="pageCount > 1" class="wallet-pagination" :aria-label="label">
    <AppButton
      variant="ghost"
      :aria-label="wt('activityPreviousPage')"
      :disabled="disabled || page <= 1"
      @click="page -= 1"
    >
      <PhCaretLeft :size="16" aria-hidden="true" />
    </AppButton>
    <span class="tabular" role="status">{{ wt('activityPageStatus', [page, pageCount]) }}</span>
    <AppButton
      variant="ghost"
      :aria-label="wt('activityNextPage')"
      :disabled="disabled || page >= pageCount"
      @click="page += 1"
    >
      <PhCaretRight :size="16" aria-hidden="true" />
    </AppButton>
  </nav>
</template>

<style scoped>
.wallet-pagination {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 8px;
  padding-block-start: 8px;
  border-block-start: 1px solid var(--hairline);
  color: var(--text-muted);
  font-size: 0.75rem;
}

.wallet-pagination > button {
  min-inline-size: 44px;
  min-block-size: 44px;
  padding-inline: 8px;
}
</style>
