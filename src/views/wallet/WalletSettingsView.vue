<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import {
  PhArrowLeft as ArrowLeft,
  PhDownloadSimple as DownloadSimple,
  PhKey as Key,
  PhLockKey as LockKey,
  PhSignOut as SignOut,
  PhUserCircle as UserCircle,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import WalletLanguageSelect from '@/components/WalletLanguageSelect.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import WalletSignOutDialog from '@/components/WalletSignOutDialog.vue'
import { type ThemePreference, usePreferences } from '@/composables/usePreferences'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const router = useRouter()
const preferences = usePreferences()
const { t } = useI18n()
const displayName = ref(wallet.profile.displayName)
const avatar = ref(wallet.profile.avatarDataUrl ?? '')
const profileBusy = ref(false)
const showSignOut = ref(false)
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

function goBack(): void {
  const previous = router.options.history.state.back
  if (typeof previous === 'string' && previous.startsWith('/wallet')) {
    const target = router.resolve(previous)
    if (
      target.matched.some((record) => record.path === '/wallet') &&
      target.name !== 'wallet-settings' &&
      target.hash !== '#settings'
    ) {
      router.back()
      return
    }
  }
  void router.replace({ name: 'wallet-overview' })
}

function setTheme(value: string): void {
  preferences.setTheme(value as ThemePreference)
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

class AvatarValidationError extends Error {}

async function cropAvatar(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new AvatarValidationError('wallet.settings.avatarTypeError')
  if (file.size > 5 * 1024 * 1024)
    throw new AvatarValidationError('wallet.settings.avatarSizeError')
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const context = canvas.getContext('2d')
  if (!context) throw new AvatarValidationError('wallet.settings.avatarUnsupportedError')
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
    profileError.value =
      cause instanceof AvatarValidationError ? cause.message : 'wallet.settings.avatarReadError'
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
    profileMessage.value = 'wallet.settings.profileSaved'
    await dashboard.sync(true)
  } catch {
    profileError.value = 'wallet.settings.profileSaveError'
  } finally {
    profileBusy.value = false
  }
}
</script>

<template>
  <div class="wallet-page settings-page">
    <div class="settings-hero">
      <button type="button" class="settings-back" @click="goBack">
        <ArrowLeft :size="17" aria-hidden="true" />{{ t('wallet.settings.back') }}
      </button>
      <WalletPageHeader :title="t('wallet.nav.settings')" variant="compact">
        <WalletFigure kind="format" :intensity="0.3" />
      </WalletPageHeader>
    </div>

    <section class="settings-section" aria-labelledby="profile-settings-heading">
      <h2 id="profile-settings-heading">{{ t('wallet.settings.profile') }}</h2>
      <div class="settings-fields">
        <div class="profile-editor">
          <label class="profile-avatar">
            <img v-if="avatar" :src="avatar" :alt="t('wallet.settings.currentAvatar')" />
            <UserCircle v-else :size="42" weight="light" />
            <span>{{ t('wallet.settings.changeAvatar') }}</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" @change="chooseAvatar" />
          </label>
          <div class="profile-name">
            <label for="wallet-display-name">{{ t('wallet.settings.username') }}</label>
            <input
              id="wallet-display-name"
              v-model="displayName"
              maxlength="24"
              autocomplete="nickname"
            />
            <small
              >{{ wallet.accountId }} ·
              {{ dashboard.current.organization ? wt('refinement35') : wt('refinement20') }}</small
            >
            <small>{{ t('wallet.settings.profileDescription') }}</small>
          </div>
          <AppButton :loading="profileBusy" :disabled="!displayName.trim()" @click="saveProfile">
            {{ t('wallet.settings.saveProfile') }}
          </AppButton>
        </div>
        <p v-if="profileError" class="settings-feedback settings-feedback--error" role="alert">
          {{ t(profileError) }}
        </p>
        <p v-else-if="profileMessage" class="settings-feedback" role="status">
          {{ t(profileMessage) }}
        </p>
      </div>
    </section>
    <section class="settings-section" aria-labelledby="preferences-heading">
      <h2 id="preferences-heading">{{ t('wallet.settings.preferences') }}</h2>
      <div class="settings-fields">
        <div class="settings-row">
          <span>
            <b>{{ t('wallet.settings.appearance') }}</b>
            <small>{{ t('wallet.settings.appearanceDescription') }}</small>
          </span>
          <SegmentedControl
            :label="t('wallet.settings.appearance')"
            :model-value="preferences.themePreference.value"
            compact
            appearance="tabs"
            :options="themeOptions"
            @update:model-value="setTheme"
          />
        </div>

        <div class="settings-row">
          <span>
            <b>{{ t('wallet.settings.language') }}</b>
            <small>{{ t('wallet.settings.languageDescription') }}</small>
          </span>
          <WalletLanguageSelect />
        </div>
      </div>
    </section>
    <section class="settings-section" aria-labelledby="wallet-controls-heading">
      <h2 id="wallet-controls-heading">{{ t('wallet.settings.access') }}</h2>
      <div class="settings-fields">
        <div class="settings-row">
          <span
            ><b>{{ t('wallet.settings.exportEncrypted') }}</b
            ><small>{{ t('wallet.settings.exportEncryptedDescription') }}</small></span
          >
          <AppButton variant="secondary" @click="exportWallet"
            ><DownloadSimple :size="17" />{{ t('wallet.settings.export') }}</AppButton
          >
        </div>
        <div class="settings-row">
          <span
            ><b>{{ t('wallet.settings.exportRecovery') }}</b
            ><small>{{ t('wallet.settings.exportRecoveryDescription') }}</small></span
          >
          <AppButton variant="secondary" @click="exportRecoveryKit"
            ><Key :size="17" />{{ t('wallet.settings.export') }}</AppButton
          >
        </div>
        <div class="settings-row">
          <span
            ><b>{{ t('wallet.settings.autoLock') }}</b
            ><small>{{ t('wallet.settings.autoLockDescription') }}</small></span
          >
          <strong>{{ t('wallet.settings.fifteenMinutes') }}</strong>
        </div>
        <div class="settings-row">
          <span
            ><b>{{ t('wallet.settings.lockNow') }}</b
            ><small>{{ t('wallet.settings.lockDescription') }}</small></span
          >
          <AppButton variant="secondary" @click="lock"
            ><LockKey :size="17" />{{ t('wallet.settings.lock') }}</AppButton
          >
        </div>
        <div class="settings-row">
          <span
            ><b>{{ wt('signOut') }}</b
            ><small>{{ wt('signOutDescription') }}</small></span
          >
          <AppButton
            variant="ghost"
            class="settings-sign-out"
            data-testid="sign-out"
            @click="showSignOut = true"
            ><SignOut :size="17" />{{ wt('signOut') }}</AppButton
          >
        </div>
      </div>
    </section>
    <WalletSignOutDialog v-model:open="showSignOut" />
  </div>
</template>

<style scoped>
.settings-page {
  container-type: inline-size;
  max-width: 1060px;
  margin-inline: auto;
  width: 100%;
  gap: 0;
  padding: clamp(16px, 3vw, 40px);
  background: var(--surface);
  border: 1px solid var(--hairline);
  border-radius: var(--radius-xl);
}
.settings-hero {
  padding-bottom: 12px;
}
.settings-back {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  min-height: 40px;
  color: var(--text-muted);
  background: transparent;
  border: 0;
  font: inherit;
  cursor: pointer;
}
.settings-back:hover {
  color: var(--accent);
}
.settings-hero :deep(.wallet-page-header) {
  flex-direction: row;
  align-items: center;
  min-height: 80px;
}
.settings-hero :deep(.wallet-figure) {
  width: 88px;
  --figure-plate: var(--surface);
}
.settings-section {
  display: grid;
  grid-template-columns: minmax(126px, 0.36fr) minmax(0, 1fr);
  gap: clamp(16px, 3vw, 40px);
  padding-block: clamp(18px, 2.4vw, 32px);
  border-top: 1px solid var(--hairline);
}
.settings-section:last-of-type {
  padding-bottom: 0;
}
.settings-section h2 {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 650;
  letter-spacing: -0.02em;
}
.settings-fields {
  min-width: 0;
}
.settings-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px 20px;
  padding-block: 16px;
}
.settings-row:first-child {
  padding-top: 0;
}
.settings-row:last-child {
  padding-bottom: 0;
}
.settings-row + .settings-row {
  border-top: 1px solid var(--hairline);
}
.settings-row > span {
  flex: 1 1 200px;
  display: grid;
  gap: 4px;
}
.settings-row b,
.settings-row strong {
  font-size: 0.94rem;
  font-weight: 600;
}
.settings-row small {
  color: var(--text-muted);
  line-height: 1.55;
}
.settings-row :deep(.segmented-control) {
  width: auto;
  min-width: 0;
  max-width: 100%;
}
.settings-row .settings-sign-out {
  color: var(--danger);
}
.profile-editor {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: 16px;
}
.profile-editor :deep(.app-button) {
  margin-top: 21px;
}
.profile-avatar {
  display: grid;
  position: relative;
  width: 64px;
  height: 64px;
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
  min-width: 0;
  gap: 0.35rem;
}
.profile-name label {
  font-size: 0.78rem;
  font-weight: 650;
}
.profile-name input {
  width: 100%;
  min-width: 0;
  min-height: 48px;
  padding: 0 0.85rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
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

.profile-name input:focus-visible {
  outline: none;
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.profile-avatar:focus-within {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

@container (max-width: 680px) {
  .settings-section {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
}
@container (max-width: 460px) {
  .profile-editor {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .profile-editor :deep(.app-button) {
    grid-column: 2;
    justify-self: start;
    margin: 0;
  }
  .profile-avatar {
    width: 50px;
    height: 50px;
  }
  .settings-row {
    align-items: flex-start;
  }
}
</style>
