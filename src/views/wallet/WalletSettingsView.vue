<script setup lang="ts">
import {
  PhDownloadSimple as DownloadSimple,
  PhKey as Key,
  PhLockKey as LockKey,
  PhUserCircle as UserCircle,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
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
const displayName = ref(wallet.profile.displayName)
const avatar = ref(wallet.profile.avatarDataUrl ?? '')
const profileBusy = ref(false)
const profileMessage = ref('')
const profileError = ref('')

watch(
  () => wallet.profile,
  (profile) => {
    displayName.value = profile.displayName
    avatar.value = profile.avatarDataUrl ?? ''
  },
)

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

async function cropAvatar(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('请选择 PNG、JPEG 或 WebP 图片。')
  if (file.size > 5 * 1024 * 1024) throw new Error('头像文件不能超过 5 MB。')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new Error('当前浏览器无法处理头像。')
  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    256,
    256,
  )
  bitmap.close()
  return canvas.toDataURL('image/webp', 0.86)
}

async function chooseAvatar(event: Event): Promise<void> {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  profileError.value = ''
  try {
    avatar.value = await cropAvatar(file)
  } catch (cause) {
    profileError.value = cause instanceof Error ? cause.message : '无法读取头像。'
  } finally {
    input.value = ''
  }
}

async function saveProfile(): Promise<void> {
  profileBusy.value = true
  profileError.value = ''
  profileMessage.value = ''
  try {
    await wallet.saveProfile(displayName.value, avatar.value || undefined)
    profileMessage.value = '个人资料已保存在本机。'
    await dashboard.sync(true)
  } catch (cause) {
    profileError.value = cause instanceof Error ? cause.message : '无法保存个人资料。'
  } finally {
    profileBusy.value = false
  }
}
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      :title="t('wallet.settings.title')"
      :description="t('wallet.settings.description')"
    />
    <section class="wallet-section profile-settings" aria-labelledby="profile-settings-heading">
      <div class="wallet-section__heading"><h2 id="profile-settings-heading">个人资料</h2></div>
      <div class="profile-editor">
        <label class="profile-avatar">
          <img v-if="avatar" :src="avatar" alt="当前头像" />
          <UserCircle v-else :size="42" weight="light" />
          <span>更换头像</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" @change="chooseAvatar" />
        </label>
        <div class="profile-name">
          <label for="wallet-display-name">用户名</label>
          <input
            id="wallet-display-name"
            v-model="displayName"
            maxlength="24"
            autocomplete="nickname"
          />
          <small>仅保存在本机，不会改变账户 ID 或链上身份。</small>
        </div>
        <AppButton :loading="profileBusy" :disabled="!displayName.trim()" @click="saveProfile">
          保存资料
        </AppButton>
      </div>
      <p v-if="profileError" class="settings-feedback settings-feedback--error" role="alert">
        {{ profileError }}
      </p>
      <p v-else-if="profileMessage" class="settings-feedback" role="status">
        {{ profileMessage }}
      </p>
    </section>
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

.settings-actions :deep(.app-button) {
  min-width: 112px;
}

.profile-editor {
  display: grid;
  grid-template-columns: auto minmax(220px, 1fr) auto;
  align-items: end;
  gap: 1rem;
  padding-block: 1rem;
}

.profile-avatar {
  display: grid;
  width: 86px;
  height: 86px;
  overflow: hidden;
  border-radius: 50%;
  background: var(--surface-raised);
  color: var(--text-muted);
  cursor: pointer;
  place-items: center;
}

.profile-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.profile-avatar span {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}
.profile-avatar input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}
.profile-name {
  display: grid;
  gap: 0.35rem;
}
.profile-name label {
  font-size: 0.78rem;
  font-weight: 650;
}
.profile-name input {
  min-height: 48px;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--field);
  color: var(--text);
}
.profile-name small,
.settings-feedback {
  color: var(--text-muted);
  font-size: 0.72rem;
}
.settings-feedback {
  margin: 0;
}
.settings-feedback--error {
  color: var(--danger);
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

  .profile-editor {
    grid-template-columns: auto 1fr;
  }
  .profile-editor :deep(.app-button) {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
