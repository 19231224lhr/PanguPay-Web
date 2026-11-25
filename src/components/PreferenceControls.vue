<script setup lang="ts">
import { PhMoon as Moon, PhSun as Sun } from '@phosphor-icons/vue'
import WalletLanguageSelect from './WalletLanguageSelect.vue'
import { useI18n } from 'vue-i18n'

import { usePreferences } from '@/composables/usePreferences'
import IconButton from './IconButton.vue'

const { t } = useI18n()
const preferences = usePreferences()

function toggleTheme(event: MouseEvent): void {
  preferences.setTheme(preferences.resolvedTheme.value === 'dark' ? 'light' : 'dark', event.currentTarget as Element)
}

</script>

<template>
  <div class="preference-controls">
    <IconButton
      :label="preferences.resolvedTheme.value === 'dark' ? t('controls.light') : t('controls.dark')"
      @click="toggleTheme"
    >
      <Sun v-if="preferences.resolvedTheme.value === 'dark'" :size="19" weight="regular" />
      <Moon v-else :size="19" weight="regular" />
    </IconButton>
    <WalletLanguageSelect />
  </div>
</template>

<style scoped>
.preference-controls {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 24px;
  background: var(--surface);
}
.preference-controls::before {
  content: '';
  order: 1;
  height: 16px;
  width: 1px;
  background: var(--border);
}
.preference-controls .wallet-language { order: 2; }
.preference-controls .icon-button {
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
}
.preference-controls .icon-button:hover {
  background: var(--surface-hover);
}
</style>
