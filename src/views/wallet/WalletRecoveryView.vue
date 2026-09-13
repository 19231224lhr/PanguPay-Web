<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import {
  PhArrowLeft as ArrowLeft,
  PhKey as Key,
  PhTrash as Trash,
  PhUploadSimple as UploadSimple,
} from '@phosphor-icons/vue'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const router = useRouter()
const wallet = useWalletStore()
const dashboard = useDashboardStore()
const recoveryValue = shallowRef<unknown>()
const recoveryFileName = ref('')
const password = ref('')
const passwordConfirm = ref('')
const localError = ref('')
const revealClear = ref(false)

const passwordError = computed(() => {
  if (password.value && new TextEncoder().encode(password.value).length < 12) return wt('w156')
  if (passwordConfirm.value && password.value !== passwordConfirm.value) return wt('w157')
  return ''
})

async function readRecoveryKit(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  recoveryFileName.value = file.name
  try {
    recoveryValue.value = JSON.parse(await file.text())
    localError.value = ''
  } catch {
    recoveryValue.value = undefined
    localError.value = wt('w158')
  }
}

async function recoverWallet(): Promise<void> {
  localError.value = ''
  if (passwordError.value || !passwordConfirm.value) return
  try {
    if (!recoveryValue.value) throw new Error(wt('w159'))
    await wallet.recoverFromKit(recoveryValue.value, password.value)
    dashboard.reset()
    await router.replace('/wallet/entry')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : wt('w160')
  }
}

async function clearLocalWallet(): Promise<void> {
  localError.value = ''
  try {
    await wallet.clearLocalWallet()
    dashboard.reset()
    await router.replace('/wallet/setup')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : wt('w161')
  }
}
</script>

<template>
  <WalletAccessFrame quiet-scroll>
    <section class="access-panel recovery-panel">
      <template v-if="!revealClear">
        <Key class="recovery-mark" :size="34" weight="regular" />
        <h1>{{ wt('w162') }}</h1>
        <p>{{ wt('w163') }}</p>

        <form class="access-form recovery-form" @submit.prevent="recoverWallet">
          <label class="file-picker">
            <input type="file" accept=".json,application/json" @change="readRecoveryKit" />
            <UploadSimple :size="20" />
            <span>{{ recoveryFileName || wt('w164') }}</span>
          </label>
          <FormField
            id="recovery-password"
            v-model="password"
            :label="wt('w165')"
            type="password"
            autocomplete="new-password"
            :help="wt('w166')"
            :error="passwordError"
          />
          <FormField
            id="recovery-password-confirm"
            v-model="passwordConfirm"
            :label="wt('w167')"
            type="password"
            autocomplete="new-password"
            :error="passwordError"
          />
          <AppButton
            type="submit"
            size="large"
            :loading="wallet.busy"
            :disabled="!recoveryValue || !passwordConfirm || !!passwordError"
          >
            {{ wt('w168') }}
          </AppButton>
        </form>

        <p v-if="localError" class="recovery-error" role="alert">{{ localError }}</p>

        <div class="recovery-divider">
          <span> {{ wt('w169') }} </span>
        </div>
        <AppButton
          class="clear-wallet-entry"
          size="large"
          variant="secondary"
          @click="revealClear = true"
        >
          <template #icon><Trash :size="17" /></template> {{ wt('w170') }}
        </AppButton>
        <RouterLink class="back-link" to="/wallet/unlock">
          <ArrowLeft :size="16" /> {{ wt('w171') }}
        </RouterLink>
      </template>

      <template v-else>
        <Trash class="clear-mark" :size="34" weight="regular" />
        <h1>{{ wt('w172') }}</h1>
        <p>{{ wt('w173') }}</p>
        <div class="clear-summary">
          <strong> {{ wt('w174') }} </strong>
          <span> {{ wt('w175') }} </span>
        </div>
        <p v-if="localError" class="recovery-error" role="alert">{{ localError }}</p>
        <div class="clear-actions">
          <AppButton variant="ghost" @click="revealClear = false"> {{ wt('w108') }} </AppButton>
          <AppButton variant="danger" :loading="wallet.busy" @click="clearLocalWallet">
            <template #icon><Trash :size="17" /></template> {{ wt('w176') }}
          </AppButton>
        </div>
      </template>
    </section>
  </WalletAccessFrame>
</template>

<style scoped>
.recovery-panel {
  display: grid;
  gap: 0.7rem;
}

.recovery-mark {
  color: var(--accent);
}

.recovery-panel > p {
  margin: 0.25rem 0 0.45rem;
}

.recovery-form {
  gap: 0.7rem;
}

.file-picker {
  display: flex;
  min-height: 60px;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  color: var(--text-muted);
  cursor: pointer;
  transition:
    border-color var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.file-picker:hover {
  border-color: var(--accent);
  color: var(--text);
}

.file-picker input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.recovery-divider {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  color: var(--text-faint);
  font-size: 0.72rem;
}

.recovery-divider::before,
.recovery-divider::after {
  height: 1px;
  flex: 1;
  background: var(--hairline);
  content: '';
}

.clear-wallet-entry {
  width: 100%;
}

.clear-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.55rem;
}

.clear-mark {
  color: var(--danger);
}

.clear-summary {
  display: grid;
  gap: 0.4rem;
  padding-block: 0.9rem;
  border-block: 1px solid var(--hairline);
}

.clear-summary strong {
  font-size: 0.88rem;
  line-height: 1.5;
}

.clear-summary span,
.recovery-error {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.5;
}

.recovery-error {
  margin: 0;
  color: var(--danger);
}

.back-link {
  display: inline-flex;
  width: fit-content;
  min-height: 44px;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-muted);
  font-size: 0.8rem;
}

.back-link:hover {
  color: var(--text);
}

@media (min-width: 901px) and (max-height: 820px) {
  .recovery-panel h1 {
    font-size: 2.25rem;
  }

  .recovery-panel :deep(.form-field) {
    gap: 0.36rem;
  }

  .recovery-panel :deep(.form-field__control) {
    min-height: 50px;
  }
}

@media (max-width: 480px) {
  .clear-actions {
    align-items: stretch;
    flex-direction: column-reverse;
  }
}
</style>
