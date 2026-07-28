<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    describedBy?: string
    id: string
    invalid?: boolean
    label: string
    modelValue: string
    error?: string
    help?: string
    type?: string
  }>(),
  {
    describedBy: '',
    error: '',
    help: '',
    invalid: false,
    type: 'text',
  },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()

const input = ref<HTMLInputElement>()

function focus(): void {
  input.value?.focus()
}

defineExpose({ focus })
</script>

<template>
  <div class="form-field" :class="{ 'form-field--error': error || invalid }">
    <label :for="id">{{ label }}</label>
    <div class="form-field__control">
      <input
        ref="input"
        :id="id"
        v-bind="$attrs"
        :type="type"
        :value="modelValue"
        :aria-invalid="error || invalid ? 'true' : undefined"
        :aria-describedby="
          [help ? `${id}-help` : '', error ? `${id}-error` : '', describedBy]
            .filter(Boolean)
            .join(' ') || undefined
        "
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <slot name="suffix" />
    </div>
    <p v-if="help" :id="`${id}-help`" class="form-field__help">{{ help }}</p>
    <p v-if="error" :id="`${id}-error`" class="form-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: grid;
  gap: 0.48rem;
}

label {
  color: var(--text);
  font-size: 0.84rem;
  font-weight: 650;
}

.form-field__control {
  display: flex;
  min-height: 48px;
  align-items: center;
  gap: 0.5rem;
  padding: 0 0.82rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
  transition:
    border-color var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard);
}

.form-field__control:focus-within {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 72%, transparent);
}

.form-field--error .form-field__control {
  border-color: color-mix(in srgb, var(--danger) 62%, var(--border-strong));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger) 46%, transparent);
  animation: field-correction 220ms var(--ease-standard);
}

input {
  width: 100%;
  min-height: 46px;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
}

input::placeholder {
  color: var(--text-faint);
}

.form-field__help,
.form-field__error {
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
}

.form-field__help {
  color: var(--text-muted);
}

.form-field__error {
  color: var(--danger);
}

@keyframes field-correction {
  0%,
  100% {
    transform: translateX(0);
  }

  38% {
    transform: translateX(-3px);
  }

  72% {
    transform: translateX(2px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .form-field--error .form-field__control {
    animation: none;
  }
}
</style>
