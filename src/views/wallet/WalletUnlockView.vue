<script setup lang="ts">
import { wt, wl } from '@/i18n/walletText'

import { PhArrowRight as ArrowRight, PhWarningCircle as WarningCircle } from '@phosphor-icons/vue'
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import CurveMark from '@/components/CurveMark.vue'
import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import InlineNotice from '@/components/InlineNotice.vue'

import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { unlockPhase, resetUnlockAnimation, revealUnlockedPage } from '@/composables/useEntryUnlock'
import { useWalletStore } from '@/stores/wallet'
import { resolveWalletArrival } from '@/wallet/entryService'

const router = useRouter()
const wallet = useWalletStore()
const password = ref('')
const unlockFailed = ref(false)
const transitioning = ref(false)
const passwordField = ref<{ focus: () => void }>()

watch(password, () => {
  unlockFailed.value = false
  wallet.clearError()
})

async function unlock(): Promise<void> {
  if (transitioning.value) return
  unlockFailed.value = false
  transitioning.value = true
  unlockPhase.value = 'loading'
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  try {
    await wallet.unlock(password.value)
    password.value = ''
    const destination = await resolveWalletArrival(wallet.accountId)
    await revealUnlockedPage(() => router.replace(destination))
  } catch {
    resetUnlockAnimation()
    transitioning.value = false
    password.value = ''
    await nextTick()
    unlockFailed.value = true
    await nextTick()
    passwordField.value?.focus()
  }
}
</script>

<template>
  <WalletAccessFrame figure="key" compact>
    <section class="access-panel">
      <div class="unlock-heading">
        <CurveMark :size="42" />
        <h1>{{ wt('w286') }}</h1>
      </div>
      <p>{{ wt('w287') }}</p>
      <form class="access-form" @submit.prevent="unlock">
        <FormField
          ref="passwordField"
          id="unlock-password"
          v-model="password"
          :label="wt('w263')"
          type="password"
          autocomplete="current-password"
          autofocus
          :invalid="unlockFailed"
          described-by="unlock-feedback"
        />
        <div id="unlock-feedback" class="unlock-feedback">
          <Transition name="unlock-error">
            <span v-if="unlockFailed" role="alert">
              <WarningCircle :size="16" weight="regular" /> {{ wt('w288') }}
            </span>
          </Transition>
          <RouterLink to="/wallet/recover"> {{ wt('w289') }} </RouterLink>
        </div>
        <AppButton type="submit" size="large" :loading="wallet.busy" :disabled="!password">
          {{ wt('w290') }} <template #icon><ArrowRight :size="18" /></template>
        </AppButton>
      </form>
      <InlineNotice v-if="wallet.error && !unlockFailed" :title="wt('w291')" tone="danger">
        {{ wl(wallet.error) }}
      </InlineNotice>
    </section>
    <p v-if="transitioning" class="unlock-progress" role="status">{{ wt('refinement58') }}</p>
  </WalletAccessFrame>
</template>

<style scoped>
.unlock-heading {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.unlock-heading h1 {
  margin: 0;
}

.unlock-feedback {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-top: -0.35rem;
  color: color-mix(in srgb, var(--danger) 82%, var(--text));
  font-size: 0.78rem;
}

.unlock-feedback > span {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.38rem;
  white-space: nowrap;
}

.unlock-feedback a {
  margin-left: auto;
  color: var(--text-muted);
  font-size: 0.8rem;
  transition: color var(--duration-state) var(--ease-standard);
}

.unlock-feedback a:hover {
  color: var(--accent);
}

.unlock-error-enter-active {
  transition:
    opacity 170ms var(--ease-standard),
    transform 170ms var(--ease-standard);
}

.unlock-error-enter-from {
  opacity: 0;
  transform: translateY(3px);
}

.unlock-progress {
  margin-top: 16px;
  color: var(--text-muted);
  font-size: 13px;
}
@media (prefers-reduced-motion: reduce) {
  .unlock-error-enter-active {
    transition: none;
  }
}
</style>
