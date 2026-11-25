<script setup lang="ts">
import { wt, wl } from '@/i18n/walletText'

import {
  PhArrowRight as ArrowRight,
  PhCheckCircle as CheckCircle,
  PhDownloadSimple as DownloadSimple,
  PhKey as Key,
  PhLockKey as LockKey,
  PhUploadSimple as UploadSimple,
  PhWarningCircle as WarningCircle,
} from '@phosphor-icons/vue'
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import CurveMark from '@/components/CurveMark.vue'
import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import FormField from '@/components/FormField.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { resetUnlockAnimation } from '@/composables/useEntryUnlock'
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
const creating = ref(false)
const continuing = ref(false)
const panelStage = ref<HTMLElement>()
const localError = ref('')
const legacyScalar = ref('')
const legacyRootSeed = ref('')
const importStage = ref<'form' | 'verifying'>('form')
const backupImportFailed = ref(false)
const importPasswordField = ref<{ focus: () => void }>()

function focusFailedImport(): void {
  if (backupImportFailed.value) importPasswordField.value?.focus()
}

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

// Move the alternative action along with the form, even when a second switch
// interrupts the first. Form controls themselves retain their natural size.
let formResize: Animation | undefined
watch([mode, importMethod, backupDownloaded], async (_next, _previous, onCleanup) => {
  const stage = panelStage.value
  if (!stage || !stage.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const before = stage.getBoundingClientRect().height
  formResize?.cancel()
  let cancelled = false
  onCleanup(() => { cancelled = true })
  await nextTick()
  if (cancelled || !stage.isConnected) return
  const after = stage.getBoundingClientRect().height
  if (Math.abs(before - after) < 1) return
  formResize = stage.animate(
    [{ height: before + 'px' }, { height: after + 'px' }],
    { duration: 210, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' },
  )
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
  if (creating.value || wallet.busy || backupDownloaded.value) return
  localError.value = ''
  if (createPasswordError.value || !createPasswordConfirm.value) return
  creating.value = true
  try {
    await paintPendingState()
    const envelope = await wallet.create(createPassword.value)
    const recoveryKit = wallet.exportRecoveryKit()
    downloadJSON(envelope, 'wallet.json')
    downloadJSON(recoveryKit, 'PanguPay-recovery.json')
    backupDownloaded.value = true
    recoveryDownloaded.value = true
  } catch (cause) {
    resetUnlockAnimation()
    localError.value = cause instanceof Error ? cause.message : wt('w251')
  } finally {
    creating.value = false
  }
}

async function continueAfterBackup(): Promise<void> {
  if (continuing.value || !backupConfirmed.value) return
  continuing.value = true
  localError.value = ''
  try {
    await wallet.confirmCreatedWallet()
    createPassword.value = ''
    createPasswordConfirm.value = ''
    await navigateWithSpatialTransition(router, '/wallet/entry', 'access', 'replace')
  } catch (cause) {
    resetUnlockAnimation()
    localError.value = cause instanceof Error ? cause.message : wt('w252')
  } finally {
    continuing.value = false
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

async function paintPendingState(): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

async function importWallet(): Promise<void> {
  if (wallet.busy || importStage.value !== 'form') return
  localError.value = ''
  wallet.clearError()
  backupImportFailed.value = false
  if (importMethod.value === 'keys') {
    if (recoveryPasswordError.value || !recoveryPasswordConfirm.value) return
  } else if (!importValue.value || !backupPassword.value) {
    localError.value = !importValue.value ? wt('w254') : wt('w255')
    return
  }
  importStage.value = 'verifying'
  await paintPendingState()
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
    focusFailedImport()
  }
}
</script>

<template>
  <WalletAccessFrame
    class="wallet-setup"
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
    <Transition name="verification-stage" mode="out-in" @after-enter="focusFailedImport">
      <section
        v-if="importStage === 'verifying'"
        key="verifying"
        class="access-panel verification-panel"
        aria-live="polite"
        aria-busy="true"
      >
        <div class="verification-heading">
          <h1>{{ verificationTitle }}</h1>
          <CurveMark variant="link" :size="36" />
        </div>
        <p>{{ verificationDescription }}</p>
        <small> {{ wt('w259') }} </small>
      </section>

      <section v-else key="form" class="access-panel">
        <div class="setup-copy" aria-live="polite">
          <Transition name="setup-copy">
            <div
              :key="backupDownloaded ? 'backup-ready' : `${mode}:${importMethod}`"
              class="setup-copy__content"
            >
              <h1>{{ setupTitle }}</h1>
              <p v-if="setupDescription" class="setup-copy__description">{{ setupDescription }}</p>
            </div>
          </Transition>
        </div>

        <div ref="panelStage" class="setup-panel-stage">
          <Transition name="setup-panel">
            <form
              v-if="mode === 'create'"
              :key="backupDownloaded ? 'backup-ready' : 'create'"
              class="access-form"
              data-setup-panel="create"
              @submit.prevent="createWallet"
            >
              <div v-if="!backupDownloaded" class="password-pair">
                <FormField
                  id="create-password"
                  :readonly="creating"
                  v-model="createPassword"
                  :label="wt('w263')"
                  type="password"
                  autocomplete="new-password"
                  described-by="create-password-guidance"
                  :invalid="!!createPasswordError"
                />
                <FormField
                  id="create-password-confirm"
                  :readonly="creating"
                  v-model="createPasswordConfirm"
                  :label="wt('w265')"
                  type="password"
                  autocomplete="new-password"
                  described-by="create-password-guidance"
                  :invalid="!!createPasswordError"
                />
                <p
                  id="create-password-guidance"
                  class="password-pair__guidance"
                  :class="{ 'password-pair__guidance--error': createPasswordError }"
                  :role="createPasswordError ? 'alert' : undefined"
                >
                  {{ createPasswordError || wt('w264') }}
                </p>
              </div>
              <AppButton
                v-if="!backupDownloaded"
                class="setup-action"
                type="submit"
                size="large"
                :loading="creating"
                :loading-label="wt('setupCreatingWallet')"
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
                class="setup-action"
                size="large"
                variant="secondary"
                :disabled="!recoveryDownloaded || !backupConfirmed"
                :loading="continuing"
                @click="continueAfterBackup"
              >
                {{ wt('w272') }} <template #icon><ArrowRight :size="17" /></template>
              </AppButton>
            </form>

            <form
              v-else
              key="import"
              class="access-form import-form"
              data-setup-panel="import"
              @submit.prevent="importWallet"
            >
              <div class="import-source">
                <span aria-hidden="true">{{ wt('w273') }}</span>
                <AppSelect
                  id="wallet-import-source"
                  v-model="importMethod"
                  inline
                  :label="wt('w273')"
                  :options="[
                    { label: 'wallet.json', value: 'backup' },
                    { label: wt('w274'), value: 'keys' },
                  ]"
                />
              </div>

              <Transition name="setup-subpanel">
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
                      <small v-if="importValue">{{ wt('w276') }}</small>
                    </span>
                  </label>
                  <FormField
                    ref="importPasswordField"
                    id="import-password"
                    v-model="backupPassword"
                    :label="wt('w278')"
                    type="password"
                    autocomplete="current-password"
                    :invalid="backupImportFailed"
                    described-by="import-feedback"
                  />
                  <AppButton
                    class="setup-action"
                    type="submit"
                    size="large"
                    :loading="wallet.busy"
                    :disabled="!importValue || !backupPassword"
                  >
                    {{ wt('w280') }}
                    <template #icon><ArrowRight :size="17" /></template>
                  </AppButton>
                  <div id="import-feedback" class="import-feedback">
                    <Transition name="import-error">
                      <span v-if="backupImportFailed || localError" role="alert">
                        <WarningCircle :size="16" weight="regular" />
                        {{ wl(localError) }}
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
                    class="setup-action"
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
                    <template #icon><ArrowRight :size="17" /></template>
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
          {{ wl(localError) || wt('w285') }}
        </p>
        <div v-if="!backupDownloaded" class="setup-alternative">
          <span>{{ mode === 'create' ? wt('setupAlreadyHaveWallet') : wt('setupNeedWallet') }}</span>
          <button type="button" :disabled="creating || wallet.busy" @click="mode = mode === 'create' ? 'import' : 'create'">
            {{ mode === 'create' ? wt('w262') : wt('w261') }}
            <ArrowRight :size="15" aria-hidden="true" />
          </button>
        </div>
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
.password-pair__guidance {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 0.76rem;
  line-height: 1.45;
  color: var(--text-muted);
}
.password-pair__guidance--error {
  color: var(--danger);
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

.setup-copy,
.setup-panel-stage,
.import-form {
  position: relative;
}

.setup-copy-leave-active,
.setup-panel-leave-active,
.setup-subpanel-leave-active {
  position: absolute;
  inset-inline: 0;
}

.setup-subpanel-leave-active {
  bottom: auto;
  grid-row: 2;
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

.setup-panel-stage {
  margin-top: 1.4rem;
}

.setup-alternative {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
  margin-top: 1.25rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--hairline);
  color: var(--text-muted);
  font-size: 0.84rem;
}

.setup-alternative button {
  display: inline-flex;
  align-items: center;
  gap: 0.38rem;
  min-height: 44px;
  padding: 0 0.2rem;
  border: 0;
  background: transparent;
  color: var(--accent-strong);
  cursor: pointer;
  font: inherit;
  font-weight: 600;
}

.setup-alternative button:hover { text-decoration: underline; text-underline-offset: 4px; }
.setup-alternative button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
.setup-alternative button:disabled { opacity: 0.55; cursor: wait; }

.import-source {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  gap: 0.5rem;
}

.import-source > span {
  color: var(--text-muted);
  font-size: 0.82rem;
}

.import-source :deep(.app-select__menu li) {
  text-transform: none;
}

#app .setup-action {
  justify-self: start;
  min-inline-size: min(11rem, 100%);
  max-inline-size: 100%;
  border-radius: 10px;
  border-color: transparent;
  box-shadow: none;
}

#app .setup-action:disabled:not([aria-busy="true"]) {
  opacity: 1;
  background: var(--surface-subtle);
  color: var(--text-faint);
  border-color: var(--hairline);
}

@media (max-width: 480px) {
  #app .setup-action {
    inline-size: 100%;
  }
}

.setup-import-panel {
  display: grid;
  gap: 1rem;
}

.verification-panel {
  align-content: center;
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

.import-feedback:empty {
  display: none;
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
  pointer-events: none;
  will-change: opacity, transform;
  transition:
    opacity 90ms ease-out,
    transform 90ms ease-out;
}

.setup-copy-enter-from,
.setup-panel-enter-from,
.setup-subpanel-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.setup-copy-leave-to,
.setup-panel-leave-to,
.setup-subpanel-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}

.file-picker {
  position: relative;
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: flex-start;
  gap: 0.65rem;
  padding: 0.72rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
  color: var(--text-muted);
  transition:
    border-color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.file-picker input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  pointer-events: none;
}

.file-picker:hover {
  border-color: var(--accent);
  color: var(--text);
}

.file-picker:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--focus);
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
