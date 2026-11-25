<script setup lang="ts">
import { PhGlobe } from '@phosphor-icons/vue'
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from './AppSelect.vue'
import { isSupportedLocale, localeNames, usePreferences } from '@/composables/usePreferences'

const { locale, t } = useI18n({ useScope: 'global' })
const preferences = usePreferences()
const id = useId()
const options = Object.entries(localeNames).map(([value, label]) => ({ value, label }))
function change(language: string) {
  if (!isSupportedLocale(language)) return
  preferences.setLocale(language)
  locale.value = language
}
</script>

<template>
  <div class="wallet-language">
    <PhGlobe :size="17" class="wallet-language__icon" aria-hidden="true" />
    <AppSelect :id="id" inline :label="t('wallet.settings.language')" :model-value="locale"
      :options="options" @update:model-value="change" />
  </div>
</template>

<style scoped>
.wallet-language { position: relative; display: inline-flex; align-items: center; }
.wallet-language__icon { position: absolute; left: 10px; z-index: 1; pointer-events: none; color: var(--text-muted); }
#app .wallet-language :deep(.app-select--inline .app-select__trigger) {
  min-height: 40px; padding: 0 10px 0 34px; gap: 8px; border-radius: 18px; color: var(--text);
}
.wallet-language :deep(.app-select__menu) { left: auto; right: 0; transform-origin: top right; }
</style>
