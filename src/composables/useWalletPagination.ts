import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue'

const pageSize = 5

export function useWalletPagination<T>(source: MaybeRefOrGetter<readonly T[]>) {
  const page = ref(1)
  const pageCount = computed(() => Math.max(1, Math.ceil(toValue(source).length / pageSize)))
  const offset = computed(() => (page.value - 1) * pageSize)
  const items = computed(() => toValue(source).slice(offset.value, offset.value + pageSize))

  watch(pageCount, (count) => (page.value = Math.min(page.value, count)))

  function goToIndex(index: number) {
    if (index >= 0 && index < toValue(source).length) page.value = Math.floor(index / pageSize) + 1
  }

  return { page, pageCount, offset, items, goToIndex }
}
