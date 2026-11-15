<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import {
  PhCheckCircle as CheckCircle,
  PhDownloadSimple as DownloadSimple,
  PhKey as Key,
  PhUploadSimple as UploadSimple,
  PhWarningCircle as WarningCircle,
} from '@phosphor-icons/vue'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import CurveMark from '@/components/CurveMark.vue'
import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { unlockPhase, resetUnlockAnimation } from '@/composables/useEntryUnlock'
import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'
import { useWalletStore } from '@/stores/wallet'
import { resolveWalletArrival } from '@/wallet/entryService'

const router = useRouter()
const wallet = useWalletStore()
const mode = ref<'create' | 'import'>(
  router.currentRoute?.value.query.mode === 'import' ? 'import' : 'create',
)
const importMethod = ref<'backup' | 'keys'>('backup')
const createPassword = ref('')
const createPasswordConfirm = ref('')
const backupPassword = ref('')
const recoveryPassword = ref('')
const recoveryPasswordConfirm = ref('')
const fileName = ref('')
const importValue = shallowRef<unknown>()
const backupDownloaded = ref(false)
const recoveryDownloaded = ref(false)
const backupConfirmed = ref(false)
const localError = ref('')
const legacyScalar = ref('')
const legacyRootSeed = ref('')
const importStage = ref<'form' | 'verifying'>('form')
const backupImportFailed = ref(false)
const importPasswordField = ref<{ focus: () => void }>()

function newPasswordError(password: string, confirmation: string): string {
  if (password && new TextEncoder().encode(password).length < 12) return wt('w240')
  if (confirmation && password !== confirmation) return wt('w157')
  return ''
}

const createPasswordError = computed(() =>
  newPasswordError(createPassword.value, createPasswordConfirm.value),
)
const recoveryPasswordError = computed(() =>
  newPasswordError(recoveryPassword.value, recoveryPasswordConfirm.value),
)
const setupTitle = computed(() => {
  if (mode.value === 'create') return backupDownloaded.value ? wt('w267') : wt('w241')
  return importMethod.value === 'backup' ? wt('w242') : wt('w243')
})
const setupDescription = computed(() => {
  if (mode.value === 'create') return backupDownloaded.value ? '' : wt('w244')
  if (importMethod.value === 'backup') return wt('w245')
  return wt('w246')
})
const verificationTitle = computed(() =>
  importMethod.value === 'backup' ? wt('w247') : wt('w248'),
)
const verificationDescription = computed(() =>
  importMethod.value === 'backup' ? wt('w249') : wt('w250'),
)

watch(backupPassword, (password) => {
  if (!password || !backupImportFailed.value) return
  backupImportFailed.value = false
  localError.value = ''
  wallet.clearError()
})

watch([mode, importMethod], () => {
  backupImportFailed.value = false
  localError.value = ''
  wallet.clearError()
})

function downloadJSON(value: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function createWallet(): Promise<void> {
  localError.value = ''
  if (createPasswordError.value || !createPasswordConfirm.value) return
  try {
    const envelope = await wallet.create(createPassword.value)
    const recoveryKit = wallet.exportRecoveryKit()
    downloadJSON(envelope, 'wallet.json')
    downloadJSON(recoveryKit, 'PanguPay-recovery.json')
    backupDownloaded.value = true
    recoveryDownloaded.value = true
  } catch (cause) {
    resetUnlockAnimation()
    localError.value = cause instanceof Error ? cause.message : wt('w251')
  }
}

async function enterCreatedWallet(): Promise<void> {
  unlockPhase.value = 'loading'
  localError.value = ''
  try {
    await wallet.confirmCreatedWallet()
    createPassword.value = ''
    createPasswordConfirm.value = ''
    const destination = await resolveWalletArrival(wallet.accountId)
    await navigateWithSpatialTransition(
      router,
      destination,
      destination === '/wallet' ? 'wallet' : 'access',
      'replace',
    )
  } catch (cause) {
    resetUnlockAnimation()
    localError.value = cause instanceof Error ? cause.message : wt('w252')
  }
}

async function readFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = ''
  importValue.value = undefined
  try {
    importValue.value = JSON.parse(await file.text())
    fileName.value = file.name
    localError.value = ''
    backupImportFailed.value = false
  } catch {
    importValue.value = undefined
    localError.value = wt('w253')
  }
}

async function showVerificationStage(): Promise<void> {
  importStage.value = 'verifying'
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function importWallet(): Promise<void> {
  localError.value = ''
  wallet.clearError()
  backupImportFailed.value = false
  if (importMethod.value === 'keys') {
    if (recoveryPasswordError.value || !recoveryPasswordConfirm.value) return
  } else if (!importValue.value || !backupPassword.value) {
    localError.value = !importValue.value ? wt('w254') : wt('w255')
    return
  }
  await showVerificationStage()
  unlockPhase.value = 'loading'
  try {
    if (importMethod.value === 'keys') {
      await wallet.importLegacy(
        legacyScalar.value,
        [{ type: 0, rootSeedHex: legacyRootSeed.value }],
        recoveryPassword.value,
      )
    } else {
      await wallet.importEnvelope(importValue.value, backupPassword.value)
    }
    const destination = await resolveWalletArrival(wallet.accountId)
    await navigateWithSpatialTransition(
      router,
      destination,
      destination === '/wallet' ? 'wallet' : 'access',
      'replace',
    )
  } catch {
    resetUnlockAnimation()
    wallet.clearError()
    if (importMethod.value === 'backup') {
      backupPassword.value = ''
      backupImportFailed.value = true
      localError.value = wt('w256')
    } else {
      localError.value = wt('w257')
    }
    importStage.value = 'form'
    await nextTick()
    if (importMethod.value === 'backup') importPasswordField.value?.focus()
  }
}
</script>

<template>
  <WalletAccessFrame
    compact
    :figure="
      importStage === 'verifying'
        ? 'shield'
        : backupDownloaded
          ? 'shield'
          : mode === 'create'
            ? 'create'
            : importMethod === 'keys'
              ? 'key'
              : 'import'
    "
  >
    <Transition name="verification-stage" mode="out-in">
      <section
        v-if="importStage === 'verifying'"
        key="verifying"
        class="access-panel verification-panel"
        aria-live="polite"
        aria-busy="true"
      >
        <span class="verification-eyebrow"> {{ wt('w258') }} </span>
        <div class="verification-heading">
          <CurveMark variant="weave" :size="44" />
          <h1>{{ verificationTitle }}</h1>
        </div>
        <p>{{ verificationDescription }}</p>
        <small> {{ wt('w259') }} </small>
      </section>

      <section v-else key="form" class="access-panel">
        <div class="setup-copy" aria-live="polite">
          <Transition name="setup-copy" mode="out-in">
            <div :key="`${mode}:${importMethod}`" class="setup-copy__content">
              <h1>{{ setupTitle }}</h1>
              <p v-if="setupDescription" class="setup-copy__description">{{ setupDescription }}</p>
            </div>
          </Transition>
        </div>

        <SegmentedControl
          v-if="!backupDownloaded"
          v-model="mode"
          :label="wt('w260')"
          :options="[
            { label: wt('w261'), value: 'create' },
            { label: wt('w262'), value: 'import' },
          ]"
        />

        <div class="setup-panel-stage">
          <Transition name="setup-panel" mode="out-in">
            <form
              v-if="mode === 'create'"
              key="create"
              class="access-form"
              data-setup-panel="create"
              @submit.prevent="createWallet"
            >
              <div v-if="!backupDownloaded" class="password-pair">
                <FormField
                  id="create-password"
                  v-model="createPassword"
                  :label="wt('w263')"
                  type="password"
                  autocomplete="new-password"
                  :help="wt('w264')"
                  :error="createPasswordError"
                />
                <FormField
                  id="create-password-confirm"
                  v-model="createPasswordConfirm"
                  :label="wt('w265')"
                  type="password"
                  autocomplete="new-password"
                  :error="createPasswordError"
                />
              </div>
              <AppButton
                v-if="!backupDownloaded"
                type="submit"
                size="large"
                :loading="wallet.busy"
                :disabled="!!createPasswordError || !createPasswordConfirm"
              >
                {{ wt('w266') }} <template #icon><DownloadSimple :size="18" /></template>
              </AppButton>
              <section v-if="backupDownloaded" class="backup-files" :aria-label="wt('w267')">
                <header>
                  <strong> {{ wt('w268') }} </strong>
                </header>
                <div>
                  <LockKey :size="19" weight="regular" />
                  <span>
                    <b>wallet.json</b>
                    <small> {{ wt('w269') }} </small>
                  </span>
                </div>
                <div>
                  <Key :size="19" weight="regular" />
                  <span>
                    <b>PanguPay-recovery.json</b>
                    <small> {{ wt('w270') }} </small>
                  </span>
                </div>
              </section>
              <label v-if="recoveryDownloaded" class="backup-confirm">
                <input v-model="backupConfirmed" type="checkbox" />
                <span> {{ wt('w271') }} </span>
              </label>
              <AppButton
                v-if="backupDownloaded"
                size="large"
                variant="secondary"
                :disabled="!recoveryDownloaded || !backupConfirmed"
                :loading="wallet.busy"
                @click="enterCreatedWallet"
              >
                {{ wt('w272') }}
              </AppButton>
            </form>

            <form
              v-else
              key="import"
              class="access-form import-form"
              data-setup-panel="import"
              @submit.prevent="importWallet"
            >
              <SegmentedControl
                v-model="importMethod"
                :label="wt('w273')"
                :options="[
                  { label: 'wallet.json', value: 'backup' },
                  { label: wt('w274'), value: 'keys' },
                ]"
              />

              <Transition name="setup-subpanel" mode="out-in">
                <div v-if="importMethod === 'backup'" key="backup" class="setup-import-panel">
                  <label class="file-picker" :class="{ 'file-picker--selected': importValue }">
                    <input
                      type="file"
                      accept=".json,application/json"
                      :aria-label="wt('w275')"
                      @change="readFile"
                    />
                    <CheckCircle v-if="importValue" :size="21" weight="fill" />
                    <UploadSimple v-else :size="20" />
                    <span class="file-picker__copy">
                      <strong>{{ fileName || wt('w275') }}</strong>
                      <small>
                        {{ importValue ? wt('w276') : wt('w277') }}
                      </small>
                    </span>
                  </label>
                  <FormField
                    ref="importPasswordField"
                    id="import-password"
                    v-model="backupPassword"
                    :label="wt('w278')"
                    type="password"
                    autocomplete="current-password"
                    :help="wt('w279')"
                    :invalid="backupImportFailed"
                    described-by="import-feedback"
                  />
                  <AppButton
                    type="submit"
                    size="large"
                    :loading="wallet.busy"
                    :disabled="!importValue || !backupPassword"
                  >
                    {{ wt('w280') }}
                  </AppButton>
                  <div id="import-feedback" class="import-feedback">
                    <Transition name="import-error">
                      <span v-if="backupImportFailed || localError" role="alert">
                        <WarningCircle :size="16" weight="regular" />
                        {{ localError }}
                      </span>
                    </Transition>
                  </div>
                </div>

                <div v-else key="keys" class="setup-import-panel">
                  <FormField
                    id="legacy-scalar"
                    v-model="legacyScalar"
                    :label="wt('w281')"
                    autocomplete="off"
                  />
                  <FormField
                    id="legacy-root"
                    v-model="legacyRootSeed"
                    :label="wt('w282')"
                    autocomplete="off"
                    :help="wt('w283')"
                  />
                  <div class="password-pair">
                    <FormField
                      id="recovery-new-password"
                      v-model="recoveryPassword"
                      :label="wt('w165')"
                      type="password"
                      autocomplete="new-password"
                      :help="wt('w166')"
                      :error="recoveryPasswordError"
                    />
                    <FormField
                      id="recovery-new-password-confirm"
                      v-model="recoveryPasswordConfirm"
                      :label="wt('w167')"
                      type="password"
                      autocomplete="new-password"
                      :error="recoveryPasswordError"
                    />
                  </div>
                  <AppButton
                    type="submit"
                    size="large"
                    :loading="wallet.busy"
                    :disabled="
                      !legacyScalar ||
                      !legacyRootSeed ||
                      !recoveryPasswordConfirm ||
                      !!recoveryPasswordError
                    "
                  >
                    {{ wt('w284') }}
                  </AppButton>
                </div>
              </Transition>
            </form>
          </Transition>
        </div>

        <p
          v-if="(localError || wallet.error) && !(mode === 'import' && importMethod === 'backup')"
          class="access-error"
          role="alert"
        >
          {{ localError || wt('w285') }}
        </p>
      </section>
    </Transition>
  </WalletAccessFrame>
</template>

<style scoped>
.password-pair {
  display: grid;
  align-items: start;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 380px) {
  .password-pair {
    grid-template-columns: 1fr;
  }
}

.access-panel {
  display: grid;
  gap: 0;
}

.setup-copy {
  min-block-size: 0;
}

.setup-copy__content {
  display: grid;
  gap: 10px;
}

.setup-copy__content > h1,
.setup-copy__content > p {
  margin: 0;
}

.setup-copy__content > p {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.55;
}

.setup-copy + .segmented-control,
.setup-panel-stage {
  margin-top: 1rem;
}

.segmented-control {
  width: 100%;
}

.setup-import-panel {
  display: grid;
  gap: 1rem;
}

.verification-panel {
  align-content: center;
  min-height: 280px;
  justify-items: start;
}

.verification-panel h1,
.verification-panel p,
.verification-panel small {
  margin: 0;
}

.verification-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}
.verification-panel h1 {
  margin-top: 0;
  font-size: clamp(28px, 2.6vw, 36px);
  letter-spacing: -0.065em;
  line-height: 0.98;
}

.verification-panel p {
  margin-top: 0.9rem;
  color: var(--text-muted);
  line-height: 1.55;
}

.verification-panel small {
  margin-top: 0.55rem;
  color: var(--text-faint);
  font-size: 0.75rem;
}

.verification-eyebrow {
  margin-top: 0;
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.12em;
}

.import-feedback {
  min-height: 34px;
}

.import-feedback > span {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0.48rem 0.65rem;
  border-radius: 12px;
  background: color-mix(in srgb, var(--danger) 7%, transparent);
  color: color-mix(in srgb, var(--danger) 78%, var(--text));
  font-size: 0.76rem;
  line-height: 1.4;
}

.verification-stage-enter-active,
.verification-stage-leave-active,
.import-error-enter-active,
.import-error-leave-active {
  transition:
    opacity 190ms var(--ease-standard),
    transform 220ms var(--ease-standard);
}

.verification-stage-enter-from,
.import-error-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.verification-stage-leave-to,
.import-error-leave-to {
  opacity: 0;
  transform: translateY(-3px);
}

.setup-copy-enter-active,
.setup-panel-enter-active,
.setup-subpanel-enter-active {
  will-change: opacity, transform;
  transition:
    opacity 180ms var(--ease-standard),
    transform 200ms var(--ease-standard);
}

.setup-copy-leave-active,
.setup-panel-leave-active,
.setup-subpanel-leave-active {
  will-change: opacity, transform;
  transition:
    opacity 90ms ease-out,
    transform 90ms ease-out;
}

.setup-copy-enter-from,
.setup-panel-enter-from,
.setup-subpanel-enter-from {
  opacity: 0;
  transform: translateY(5px);
}

.setup-copy-leave-to,
.setup-panel-leave-to,
.setup-subpanel-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

.file-picker {
  display: flex;
  min-height: 64px;
  align-items: center;
  justify-content: flex-start;
  gap: 0.65rem;
  padding-inline: 1rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  cursor: pointer;
  color: var(--text-muted);
  transition:
    border-color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.file-picker input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.file-picker:hover {
  border-color: var(--accent);
  color: var(--text);
}

.file-picker--selected {
  border-style: solid;
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface-subtle));
}

.file-picker--selected > svg {
  color: var(--accent);
}

.file-picker__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.file-picker__copy strong {
  overflow: hidden;
  color: var(--text);
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-picker__copy small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.4;
}

.backup-confirm {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.backup-files {
  display: grid;
  border-block: 1px solid var(--hairline);
}

.backup-files > header,
.backup-files > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.72rem;
  padding: 0.78rem 0.1rem;
}

.backup-files > header {
  grid-template-columns: 1fr;
  border-bottom: 1px solid var(--hairline);
}

.backup-files > header > span,
.backup-files small {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.backup-files > div + div {
  border-top: 1px solid var(--hairline);
}

.backup-files > div > svg {
  color: var(--accent);
}

.backup-files > div > span {
  display: grid;
  gap: 0.12rem;
}

.backup-files b {
  font-size: 0.8rem;
}

.backup-confirm input {
  width: 18px;
  height: 18px;
}

.access-error {
  margin: 0 !important;
  color: var(--danger) !important;
  font-size: 0.82rem;
}

@media (prefers-reduced-motion: reduce) {
  .setup-copy-enter-active,
  .setup-panel-enter-active,
  .setup-subpanel-enter-active {
    transition: opacity 65ms linear;
  }

  .setup-copy-leave-active,
  .setup-panel-leave-active,
  .setup-subpanel-leave-active {
    transition: opacity 55ms linear;
  }

  .setup-copy-enter-from,
  .setup-panel-enter-from,
  .setup-subpanel-enter-from,
  .setup-copy-leave-to,
  .setup-panel-leave-to,
  .setup-subpanel-leave-to {
    transform: none;
  }

  .verification-stage-enter-active,
  .verification-stage-leave-active,
  .import-error-enter-active,
  .import-error-leave-active {
    transition: opacity 80ms linear;
  }
}
</style>
