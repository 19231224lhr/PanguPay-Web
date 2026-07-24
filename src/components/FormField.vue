<script setup lang="ts">
defineOptions({ inheritAttrs: false })

withDefaults(
  defineProps<{
    id: string
    label: string
    modelValue: string
    error?: string
    help?: string
    type?: string
  }>(),
  {
    error: '',
    help: '',
    type: 'text',
  },
)

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div class="form-field" :class="{ 'form-field--error': error }">
    <label :for="id">{{ label }}</label>
    <div class="form-field__control">
      <input
        :id="id"
        v-bind="$attrs"
        :type="type"
        :value="modelValue"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="
          [help ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') ||
          undefined
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
  box-shadow: 0 0 0 3px var(--focus);
}

.form-field--error .form-field__control {
  border-color: var(--danger);
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
</style>
