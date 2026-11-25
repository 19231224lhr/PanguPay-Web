<script setup lang="ts" generic="T">
import { watch } from 'vue'

import WalletPagination from '@/components/WalletPagination.vue'
import { useWalletPagination } from '@/composables/useWalletPagination'

const props = defineProps<{ items: readonly T[]; label: string; focusIndex?: number }>()
defineSlots<{ default(props: { rows: T[]; offset: number }): unknown }>()

const { page, pageCount, offset, items: rows, goToIndex } = useWalletPagination(() => props.items)
watch(
  () => props.focusIndex,
  (index) => {
    if (index != null) goToIndex(index)
  },
  { immediate: true },
)
</script>

<template>
  <slot :rows="rows" :offset="offset" />
  <WalletPagination v-model="page" :page-count="pageCount" :label="label" />
</template>
