<script setup lang="ts">
import { computed, useId, ref } from 'vue'

import AnimatedNumber from './AnimatedNumber.vue'

export interface SegmentedControlOption {
  disabled?: boolean
  label: string
  value: string
  count?: number
}

const props = withDefaults(
  defineProps<{
    compact?: boolean
    semantics?: 'radio' | 'buttons'
    disabled?: boolean
    label: string
    modelValue: string
    options: SegmentedControlOption[]
  }>(),
  {
    disabled: false,
    compact: false,
    semantics: 'radio',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const keyboard = ref(false)
const root = ref<HTMLFieldSetElement>()
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
  if (!props.disabled && !props.options.find((o) => o.value === value)?.disabled)
    emit('update:modelValue', value)
}
function onKey(event: KeyboardEvent) {
  keyboard.value = true
  if (
    props.semantics !== 'buttons' ||
    !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key) ||
    props.disabled
  )
    return
  event.preventDefault()
  const enabled = props.options.filter((o) => !o.disabled)
  if (!enabled.length) return
  let index = enabled.findIndex((o) => o.value === props.modelValue)
  index =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? enabled.length - 1
        : (index + (event.key === 'ArrowRight' ? 1 : -1) + enabled.length) % enabled.length
  const value = enabled[index]!.value
  select(value)
  root.value
    ?.querySelectorAll<HTMLButtonElement>('button')
    [props.options.findIndex((o) => o.value === value)]?.focus()
}
</script>

<template>
  <fieldset
    ref="root"
    class="segmented-control"
    :class="{ 'segmented-control--compact': compact, 'is-keyboard': keyboard }"
    :disabled="disabled"
    :style="controlStyle"
    @keydown="onKey"
    @pointerdown="keyboard = false"
  >
    <legend class="sr-only">{{ label }}</legend>
    <span
      v-if="options.length"
      class="segmented-control__indicator"
      data-segment-indicator
      aria-hidden="true"
    />
    <component
      :is="semantics === 'buttons' ? 'button' : 'label'"
      class="segmented-control__option"
      :type="semantics === 'buttons' ? 'button' : undefined"
      :aria-pressed="semantics === 'buttons' ? modelValue === option.value : undefined"
      :disabled="semantics === 'buttons' ? option.disabled : undefined"
      @click="semantics === 'buttons' && select(option.value)"
      v-for="option in options"
      :key="option.value"
      :data-selected="modelValue === option.value || undefined"
    >
      <input
        v-if="semantics === 'radio'"
        type="radio"
        :name="controlName"
        :value="option.value"
        :checked="modelValue === option.value"
        :disabled="option.disabled"
        @change="select(option.value)"
      />
      <span
        >{{ option.label }}
        <strong v-if="option.count != null"><AnimatedNumber :value="option.count" /></strong
      ></span>
    </component>
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
}

.segmented-control__option {
  position: relative;
  z-index: 1;
  display: grid;
  min-width: 78px;
  padding: 0;
  border: 0;
  background: transparent;
  font: inherit;
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

.segmented-control__option > span {
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

.segmented-control__option[data-selected] > span {
  color: var(--text);
}

input:focus-visible + span {
  box-shadow: inset 0 0 0 2px var(--focus);
}

.segmented-control__option:active > span {
  transform: scale(0.985);
}

input:disabled {
  cursor: not-allowed;
}

.segmented-control__option:disabled,
.segmented-control__option:has(input:disabled) {
  cursor: not-allowed;
  opacity: 0.44;
}

.segmented-control:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

@media (hover: hover) and (pointer: fine) {
  .segmented-control__option:not([data-selected]):not(:has(input:disabled)):hover > span {
    color: var(--text);
  }
}

@media (prefers-reduced-motion: reduce) {
  .segmented-control__indicator,
  .segmented-control__option > span {
    transition-duration: 0.01ms;
  }

  .segmented-control__option:active > span {
    transform: none;
  }
}
.segmented-control.is-keyboard .segmented-control__indicator {
  transition: none;
}
.segmented-control__option:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
  border-radius: 10px;
}
.segmented-control--compact {
  display: grid;
  width: 100%;
  min-height: 44px;
}
.segmented-control--compact .segmented-control__option {
  min-width: 0;
  min-height: 44px;
}
.segmented-control--compact .segmented-control__option > span {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.45rem;
  padding: 0.35rem;
  font-size: 0.75rem;
}
.segmented-control--compact strong {
  font-variant-numeric: tabular-nums;
  font-size: 0.9rem;
}
@media (max-width: 520px) {
  .segmented-control--compact .segmented-control__option > span {
    flex-direction: column;
    gap: 0.2rem;
    font-size: 0.65rem;
  }
}
</style>
