<script setup lang="ts">
import { computed, useId } from 'vue'

export interface SegmentedControlOption {
  disabled?: boolean
  label: string
  value: string
}

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    label: string
    modelValue: string
    options: SegmentedControlOption[]
  }>(),
  {
    disabled: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const controlName = `segmented-${useId()}`
const activeIndex = computed(() => {
  const index = props.options.findIndex((option) => option.value === props.modelValue)
  return Math.max(0, index)
})
const controlStyle = computed(() => ({
  '--segment-count': String(Math.max(1, props.options.length)),
  '--segment-index': String(activeIndex.value),
}))

function select(value: string): void {
  emit('update:modelValue', value)
}
</script>

<template>
  <fieldset class="segmented-control" :disabled="disabled" :style="controlStyle">
    <legend class="sr-only">{{ label }}</legend>
    <span
      v-if="options.length"
      class="segmented-control__indicator"
      data-segment-indicator
      aria-hidden="true"
    />
    <label
      v-for="option in options"
      :key="option.value"
      :data-selected="modelValue === option.value || undefined"
    >
      <input
        type="radio"
        :name="controlName"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="option.disabled"
        @change="select(option.value)"
      />
      <span>{{ option.label }}</span>
    </label>
  </fieldset>
</template>

<style scoped>
.segmented-control {
  position: relative;
  isolation: isolate;
  display: inline-grid;
  grid-template-columns: repeat(var(--segment-count), minmax(0, 1fr));
  min-height: 52px;
  margin: 0;
  padding: 4px;
  border: 1px solid var(--selection-border);
  border-radius: var(--radius-lg);
  background: var(--selection-rail);
  box-shadow: var(--selection-rail-shadow);
}

.segmented-control__indicator {
  position: absolute;
  z-index: -1;
  top: 4px;
  bottom: 4px;
  left: 4px;
  width: calc((100% - 8px) / var(--segment-count));
  border-radius: 12px;
  background: var(--selection-lens);
  box-shadow: var(--selection-lens-shadow);
  pointer-events: none;
  transform: translate3d(calc(var(--segment-index) * 100%), 0, 0);
  transition:
    transform var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard);
  will-change: transform;
}

label {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 78px;
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

label > span {
  display: grid;
  width: 100%;
  min-height: 44px;
  padding: 0 0.88rem;
  border-radius: 12px;
  color: var(--text-muted);
  font-size: 0.84rem;
  font-weight: 620;
  line-height: 1.2;
  place-items: center;
  pointer-events: none;
  transition:
    color var(--duration-state) var(--ease-standard),
    transform var(--duration-press) var(--ease-press),
    box-shadow var(--duration-state) var(--ease-standard);
}

label[data-selected] > span {
  color: var(--text);
}

input:focus-visible + span {
  box-shadow: inset 0 0 0 2px var(--focus);
}

label:active > span {
  transform: scale(0.985);
}

input:disabled {
  cursor: not-allowed;
}

label:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.44;
}

.segmented-control:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

@media (hover: hover) and (pointer: fine) {
  label:not([data-selected]):not(:has(input:disabled)):hover > span {
    color: var(--text);
  }
}

@media (prefers-reduced-motion: reduce) {
  .segmented-control__indicator,
  label > span {
    transition-duration: 0.01ms;
  }

  label:active > span {
    transform: none;
  }
}
</style>
