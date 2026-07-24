<script setup lang="ts">
defineProps<{
  label: string
  modelValue: string
  options: Array<{ label: string; value: string }>
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <fieldset class="segmented-control">
    <legend class="sr-only">{{ label }}</legend>
    <label v-for="option in options" :key="option.value">
      <input
        type="radio"
        :name="label"
        :value="option.value"
        :checked="modelValue === option.value"
        @change="$emit('update:modelValue', option.value)"
      />
      <span>{{ option.label }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.segmented-control {
  display: inline-flex;
  min-height: 44px;
  margin: 0;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
}

label {
  position: relative;
  display: grid;
  min-width: 72px;
  min-height: 44px;
  cursor: pointer;
  place-items: center;
}

input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  opacity: 0;
}

span {
  display: grid;
  width: 100%;
  min-height: 36px;
  padding: 0 0.72rem;
  border-radius: 10px;
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 620;
  place-items: center;
  pointer-events: none;
  transition:
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard);
}

input:checked + span {
  background: var(--surface-raised);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.08);
  color: var(--text);
}

input:focus-visible + span {
  outline: 3px solid var(--focus);
}
</style>
