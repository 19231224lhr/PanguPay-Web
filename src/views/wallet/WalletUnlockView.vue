<script setup lang="ts">
import {
  PhArrowRight as ArrowRight,
  PhLockKey as LockKey,
  PhWarningCircle as WarningCircle,
} from '@phosphor-icons/vue'
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import ValueFoldField from '@/components/ValueFoldField.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'
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
  unlockFailed.value = false
  transitioning.value = true
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  try {
    await wallet.unlock(password.value)
    password.value = ''
    const destination = await resolveWalletArrival(wallet.accountId)
    await navigateWithSpatialTransition(
      router,
      destination,
      destination === '/wallet' ? 'wallet' : 'access',
      'replace',
    )
  } catch {
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
  <WalletAccessFrame>
    <section class="access-panel">
      <LockKey class="unlock-mark" :size="34" weight="regular" />
      <h1>欢迎回来</h1>
      <p>钱包密钥仍在本机。输入密码后，秘密只会短暂存在于当前页面内存中。</p>
      <form class="access-form" @submit.prevent="unlock">
        <FormField
          ref="passwordField"
          id="unlock-password"
          v-model="password"
          label="钱包密码"
          type="password"
          autocomplete="current-password"
          autofocus
          :invalid="unlockFailed"
          described-by="unlock-feedback"
        />
        <div id="unlock-feedback" class="unlock-feedback">
          <Transition name="unlock-error">
            <span v-if="unlockFailed" role="alert">
              <WarningCircle :size="16" weight="regular" />
              无法解锁，请检查密码。
            </span>
          </Transition>
          <RouterLink to="/wallet/recover">忘记密码？</RouterLink>
        </div>
        <AppButton type="submit" size="large" :loading="wallet.busy" :disabled="!password">
          解锁钱包
          <template #icon><ArrowRight :size="18" /></template>
        </AppButton>
      </form>
      <InlineNotice v-if="wallet.error && !unlockFailed" title="本地钱包不可用" tone="danger">
        {{ wallet.error }}
      </InlineNotice>
    </section>
    <Teleport to="body">
      <Transition name="unlock-transition">
        <div v-if="transitioning" class="unlock-transition" aria-live="polite">
          <ValueFoldField :intro="false" active label="正在解锁 PanguPay 钱包" />
          <p>正在解锁钱包</p>
        </div>
      </Transition>
    </Teleport>
  </WalletAccessFrame>
</template>

<style scoped>
.unlock-mark {
  margin-bottom: 1.15rem;
  color: var(--accent);
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

.unlock-transition {
  position: fixed;
  z-index: 120;
  inset: 0;
  display: grid;
  overflow: hidden;
  background: var(--background);
  place-items: center;
}

.unlock-transition :deep(.value-fold-field) {
  width: min(720px, 78vw, 74dvh);
}

.unlock-transition p {
  position: absolute;
  bottom: max(2rem, 7vh);
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
  letter-spacing: 0.08em;
}

.unlock-transition-enter-active,
.unlock-transition-leave-active {
  transition: opacity 220ms var(--ease-standard);
}

.unlock-transition-enter-from,
.unlock-transition-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .unlock-error-enter-active {
    transition: none;
  }

  .unlock-transition-enter-active,
  .unlock-transition-leave-active {
    transition-duration: 120ms;
  }
}
</style>
