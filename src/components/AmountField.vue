<script setup lang="ts">
import FormField from './FormField.vue'

withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    currency?: string
    error?: string
  }>(),
  {
    currency: 'PGC',
    error: '',
  },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <FormField
    :id="id"
    inputmode="decimal"
    autocomplete="off"
    :label="label"
    :model-value="modelValue"
    :error="error"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <template #suffix>
      <span class="amount-field__currency">{{ currency }}</span>
    </template>
  </FormField>
</template>

<style scoped>
.amount-field__currency {
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.05em;
}
</style>
