<script setup lang="ts">
import { PhMoon as Moon, PhSun as Sun, PhTranslate as Translate } from '@phosphor-icons/vue'
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { usePreferences } from '@/composables/usePreferences'
import IconButton from './IconButton.vue'

const { locale: i18nLocale, t } = useI18n()
const preferences = usePreferences()

watch(
  preferences.locale,
  (value) => {
    i18nLocale.value = value
  },
  { immediate: true },
)

function toggleTheme(): void {
  preferences.setTheme(preferences.resolvedTheme.value === 'dark' ? 'light' : 'dark')
}

function toggleLocale(): void {
  preferences.setLocale(preferences.locale.value === 'zh-CN' ? 'en-US' : 'zh-CN')
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
    <IconButton
      :label="preferences.locale.value === 'zh-CN' ? t('controls.english') : t('controls.chinese')"
      @click="toggleLocale"
    >
      <Translate :size="19" weight="regular" />
    </IconButton>
  </div>
</template>

<style scoped>
.preference-controls {
  display: flex;
  align-items: center;
  gap: 0.42rem;
}
</style>
