<script setup lang="ts">
import { PhCaretDown as CaretDown, PhCheck as Check } from '@phosphor-icons/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

export interface AppSelectOption {
  description?: string
  disabled?: boolean
  label: string
  monospace?: boolean
  value: string
}

const props = withDefaults(
  defineProps<{
    disabled?: boolean
    emptyLabel?: string
    error?: string
    help?: string
    id: string
    label: string
    modelValue: string
    options: AppSelectOption[]
    placeholder?: string
  }>(),
  {
    disabled: false,
    emptyLabel: '没有可用选项',
    error: '',
    help: '',
    placeholder: '请选择',
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const instanceId = useId()
const root = ref<HTMLElement>()
const trigger = ref<HTMLButtonElement>()
const listbox = ref<HTMLElement>()
const open = ref(false)
const activeIndex = ref(0)

const labelId = `${props.id}-${instanceId}-label`
const valueId = `${props.id}-${instanceId}-value`
const listboxId = `${props.id}-${instanceId}-listbox`
const helpId = `${props.id}-${instanceId}-help`
const errorId = `${props.id}-${instanceId}-error`
const describedBy = computed(() => (props.error ? errorId : props.help ? helpId : undefined))
const selectedIndex = computed(() =>
  props.options.findIndex((option) => option.value === props.modelValue),
)
const selectedOption = computed(() => props.options[selectedIndex.value])
const triggerDisabled = computed(() => props.disabled || props.options.length === 0)

function optionId(index: number): string {
  return `${props.id}-${instanceId}-option-${index}`
}

function firstEnabledIndex(from: number, direction: 1 | -1): number {
  if (!props.options.length) return -1
  let index = from
  for (let offset = 0; offset < props.options.length; offset += 1) {
    index = (index + direction + props.options.length) % props.options.length
    if (!props.options[index]?.disabled) return index
  }
  return -1
}

async function openMenu(preferLast = false): Promise<void> {
  if (triggerDisabled.value) return
  const fallback = preferLast ? 0 : -1
  const direction = preferLast ? -1 : 1
  const selected = selectedIndex.value
  activeIndex.value =
    selected >= 0 && !props.options[selected]?.disabled
      ? selected
      : firstEnabledIndex(fallback, direction)
  open.value = true
  await nextTick()
  listbox.value?.focus()
}

function closeMenu(returnFocus = true): void {
  if (!open.value) return
  open.value = false
  if (returnFocus) nextTick(() => trigger.value?.focus())
}

function commit(option: AppSelectOption): void {
  if (option.disabled) return
  emit('update:modelValue', option.value)
  closeMenu()
}

function moveActive(direction: 1 | -1): void {
  const next = firstEnabledIndex(activeIndex.value, direction)
  if (next >= 0) activeIndex.value = next
}

function onTriggerKeydown(event: KeyboardEvent): void {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
  event.preventDefault()
  void openMenu(event.key === 'ArrowUp')
}

function onListboxKeydown(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveActive(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    const start = event.key === 'Home' ? -1 : 0
    const direction = event.key === 'Home' ? 1 : -1
    const next = firstEnabledIndex(start, direction)
    if (next >= 0) activeIndex.value = next
    return
  }
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    const option = props.options[activeIndex.value]
    if (option) commit(option)
    return
  }
  if (event.key === 'Escape') {
    event.preventDefault()
    closeMenu()
    return
  }
  if (event.key === 'Tab') closeMenu(false)
}

function onWindowPointerDown(event: PointerEvent): void {
  if (!open.value || root.value?.contains(event.target as Node)) return
  closeMenu(false)
}

function onWindowKeydown(event: KeyboardEvent): void {
  if (open.value && event.key === 'Escape') closeMenu()
}

watch(selectedIndex, (index) => {
  if (!open.value || index < 0 || props.options[index]?.disabled) return
  activeIndex.value = index
})

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeydown)
})
</script>

<template>
  <div ref="root" class="app-select" :data-open="open || undefined">
    <label :id="labelId" class="app-select__label" :for="id">
      {{ label }}
    </label>

    <div class="app-select__desktop">
      <button
        :id="id"
        ref="trigger"
        class="app-select__trigger"
        type="button"
        data-select-trigger
        aria-haspopup="listbox"
        :aria-expanded="open"
        :aria-controls="listboxId"
        :aria-labelledby="`${labelId} ${valueId}`"
        :aria-describedby="describedBy"
        :aria-invalid="error ? 'true' : undefined"
        :disabled="triggerDisabled"
        @click="open ? closeMenu() : openMenu()"
        @keydown="onTriggerKeydown"
      >
        <span :id="valueId" class="app-select__value">
          <strong>{{
            selectedOption?.label ?? (options.length ? placeholder : emptyLabel)
          }}</strong>
          <small
            v-if="selectedOption?.description"
            :class="{ 'app-select__description--mono': selectedOption.monospace }"
          >
            {{ selectedOption.description }}
          </small>
        </span>
        <CaretDown
          class="app-select__caret"
          :class="{ 'app-select__caret--open': open }"
          :size="18"
          weight="bold"
          aria-hidden="true"
        />
      </button>

      <Transition name="select-menu">
        <ul
          v-if="open"
          :id="listboxId"
          ref="listbox"
          class="app-select__menu"
          role="listbox"
          tabindex="-1"
          :aria-labelledby="labelId"
          :aria-activedescendant="optionId(activeIndex)"
          @keydown="onListboxKeydown"
        >
          <li
            v-for="(option, index) in options"
            :id="optionId(index)"
            :key="option.value"
            role="option"
            :aria-selected="modelValue === option.value"
            :aria-disabled="option.disabled || undefined"
            :data-active="activeIndex === index || undefined"
            :data-selected="modelValue === option.value || undefined"
            @click="commit(option)"
            @pointermove="!option.disabled && (activeIndex = index)"
          >
            <span class="app-select__option-copy">
              <strong>{{ option.label }}</strong>
              <small
                v-if="option.description"
                :class="{ 'app-select__description--mono': option.monospace }"
              >
                {{ option.description }}
              </small>
            </span>
            <Check
              v-if="modelValue === option.value"
              class="app-select__check"
              :size="17"
              weight="bold"
              aria-hidden="true"
            />
          </li>
        </ul>
      </Transition>
    </div>

    <p v-if="error" :id="errorId" class="app-select__message app-select__message--error">
      {{ error }}
    </p>
    <p v-else-if="help" :id="helpId" class="app-select__message">{{ help }}</p>
  </div>
</template>

<style scoped>
.app-select {
  display: grid;
  gap: 0.48rem;
  min-width: 0;
}

.app-select__label {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 650;
}

.app-select__desktop {
  position: relative;
  min-width: 0;
}

.app-select__trigger {
  width: 100%;
  min-height: 56px;
  border: 1px solid var(--selection-border);
  border-radius: var(--radius-md);
  outline: 0;
  background: var(--surface-raised);
  color: var(--text);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.035);
  transition:
    border-color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard),
    transform var(--duration-press) var(--ease-press);
}

.app-select__trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.8rem;
  padding: 0.62rem 0.78rem 0.62rem 1rem;
  cursor: pointer;
  text-align: left;
}

.app-select__trigger:active:not(:disabled) {
  transform: scale(0.993);
}

.app-select__trigger:focus-visible {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 2px var(--focus);
}

.app-select[data-open] .app-select__trigger {
  border-color: color-mix(in srgb, var(--accent) 44%, var(--selection-border));
  background: var(--selection-rail);
}

.app-select__value,
.app-select__option-copy {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
}

.app-select__value strong,
.app-select__option-copy strong {
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 620;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select__value small,
.app-select__option-copy small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 470;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-select__description--mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
}

.app-select__caret {
  flex: none;
  color: var(--text-muted);
  transition:
    color var(--duration-state) var(--ease-standard),
    transform var(--duration-state) var(--ease-standard);
}

.app-select__caret--open {
  color: var(--accent);
  transform: rotate(-180deg);
}

.app-select__menu {
  position: absolute;
  z-index: 70;
  top: calc(100% + 8px);
  right: 0;
  left: 0;
  display: grid;
  max-height: 288px;
  gap: 2px;
  margin: 0;
  overflow-y: auto;
  padding: 6px;
  border: 1px solid var(--menu-border);
  border-radius: var(--radius-md);
  outline: 0;
  background: var(--menu-surface);
  box-shadow: var(--shadow-menu);
  backdrop-filter: blur(22px) saturate(145%);
  list-style: none;
  scrollbar-width: none;
  transform-origin: 50% 0;
}

.app-select__menu::-webkit-scrollbar {
  display: none;
}

.app-select__menu li {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 52px;
  align-items: center;
  gap: 0.8rem;
  padding: 0.58rem 0.7rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  user-select: none;
  transition:
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.app-select__menu li[data-active] {
  background: var(--surface-hover);
  color: var(--text);
}

.app-select__menu li[data-selected] {
  background: var(--selection-lens);
  color: var(--text);
}

.app-select__menu li[aria-disabled='true'] {
  cursor: not-allowed;
  opacity: 0.42;
}

.app-select__check {
  color: var(--accent);
}

.app-select__message {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.45;
}

.app-select__message--error {
  color: var(--danger);
}

.app-select__trigger:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.select-menu-enter-active,
.select-menu-leave-active {
  transition:
    opacity 170ms var(--ease-standard),
    transform 170ms var(--ease-standard),
    filter 170ms var(--ease-standard);
}

.select-menu-enter-from,
.select-menu-leave-to {
  opacity: 0;
  filter: blur(3px);
  transform: translateY(-4px) scale(0.985);
}

@media (prefers-reduced-transparency: reduce) {
  .app-select__menu {
    background: var(--surface-raised);
    backdrop-filter: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-select__trigger,
  .app-select__caret,
  .app-select__menu li,
  .select-menu-enter-active,
  .select-menu-leave-active {
    transition-duration: 0.01ms;
  }

  .app-select__trigger:active:not(:disabled),
  .select-menu-enter-from,
  .select-menu-leave-to {
    filter: none;
    transform: none;
  }
}

@media (max-width: 767px) {
  .app-select__menu {
    max-height: min(248px, 42dvh);
  }
}
</style>
