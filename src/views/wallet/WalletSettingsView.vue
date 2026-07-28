<script setup lang="ts">
import {
  PhDownloadSimple as DownloadSimple,
  PhKey as Key,
  PhLockKey as LockKey,
} from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import {
  type SupportedLocale,
  type ThemePreference,
  usePreferences,
} from '@/composables/usePreferences'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const router = useRouter()
const preferences = usePreferences()
const { locale: i18nLocale, t } = useI18n()

const themeOptions = computed(() => [
  { label: t('common.system'), value: 'system' },
  { label: t('common.light'), value: 'light' },
  { label: t('common.dark'), value: 'dark' },
])

const languageOptions = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
]

function setTheme(value: string): void {
  preferences.setTheme(value as ThemePreference)
}

function setLocale(value: string): void {
  const locale = value as SupportedLocale
  preferences.setLocale(locale)
  i18nLocale.value = locale
}

function exportWallet(): void {
  const blob = new Blob([JSON.stringify(wallet.exportEnvelope(), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'wallet.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function exportRecoveryKit(): void {
  const blob = new Blob([JSON.stringify(wallet.exportRecoveryKit(), null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'PanguPay-recovery.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function lock(): void {
  wallet.lock()
  dashboard.reset()
  void router.replace('/wallet/unlock')
}
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      :title="t('wallet.settings.title')"
      :description="t('wallet.settings.description')"
    />
    <section class="wallet-section settings-preferences" aria-labelledby="preferences-heading">
      <div class="wallet-section__heading">
        <h2 id="preferences-heading">{{ t('wallet.settings.preferences') }}</h2>
      </div>
      <div class="settings-row">
        <span>
          <b>{{ t('wallet.settings.appearance') }}</b>
          <small>{{ t('wallet.settings.appearanceDescription') }}</small>
        </span>
        <SegmentedControl
          :label="t('wallet.settings.appearance')"
          :model-value="preferences.themePreference.value"
          :options="themeOptions"
          @update:model-value="setTheme"
        />
      </div>
      <div class="settings-row">
        <span>
          <b>{{ t('wallet.settings.language') }}</b>
          <small>{{ t('wallet.settings.languageDescription') }}</small>
        </span>
        <SegmentedControl
          :label="t('wallet.settings.language')"
          :model-value="preferences.locale.value"
          :options="languageOptions"
          @update:model-value="setLocale"
        />
      </div>
    </section>
    <section class="wallet-section settings-actions" aria-labelledby="wallet-controls-heading">
      <div class="wallet-section__heading">
        <h2 id="wallet-controls-heading">钱包与访问</h2>
      </div>
      <div>
        <span><b>导出加密备份</b><small>下载兼容 wallet-keystore v1 的 wallet.json。</small></span
        ><AppButton variant="secondary" @click="exportWallet"
          ><DownloadSimple :size="18" />导出</AppButton
        >
      </div>
      <div>
        <span
          ><b>导出独立恢复材料</b
          ><small>包含未加密私钥与 RootSeed；只应离线保存，任何人都不应向你索取。</small></span
        ><AppButton variant="secondary" @click="exportRecoveryKit"
          ><Key :size="18" />导出</AppButton
        >
      </div>
      <div>
        <span><b>立即锁定</b><small>清除当前页面内存中的私钥与 RootSeed。</small></span
        ><AppButton variant="secondary" @click="lock"><LockKey :size="18" />锁定</AppButton>
      </div>
      <div>
        <span><b>自动锁定</b><small>连续 15 分钟无操作后自动锁定。</small></span
        ><strong>15 分钟</strong>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-actions {
  display: grid;
}

.settings-preferences,
.settings-actions {
  display: grid;
}

.settings-row,
.settings-actions > div {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--hairline);
}

.settings-preferences > div:last-child,
.settings-actions > div:last-child {
  border-bottom: 0;
}

.settings-preferences span,
.settings-actions span {
  display: grid;
  gap: 0.25rem;
}

.settings-preferences small,
.settings-actions small {
  color: var(--text-muted);
}

@media (max-width: 599px) {
  .settings-row,
  .settings-actions > div {
    align-items: stretch;
    flex-direction: column;
    padding-block: 1rem;
  }

  .settings-preferences :deep(.segmented-control),
  .settings-actions :deep(.app-button) {
    width: 100%;
  }
}
</style>
