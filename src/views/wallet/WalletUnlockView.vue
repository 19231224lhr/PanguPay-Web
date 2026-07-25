<script setup lang="ts">
import { PhArrowRight as ArrowRight, PhLockKey as LockKey } from '@phosphor-icons/vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { useWalletStore } from '@/stores/wallet'

const router = useRouter()
const wallet = useWalletStore()
const password = ref('')
const localError = ref('')

async function unlock(): Promise<void> {
  localError.value = ''
  try {
    await wallet.unlock(password.value)
    password.value = ''
    await router.replace('/wallet')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '解锁失败'
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
          id="unlock-password"
          v-model="password"
          label="钱包密码"
          type="password"
          autocomplete="current-password"
          autofocus
        />
        <AppButton type="submit" size="large" :loading="wallet.busy" :disabled="!password">
          解锁钱包
          <template #icon><ArrowRight :size="18" /></template>
        </AppButton>
      </form>
      <p v-if="localError || wallet.error" class="access-error" role="alert">
        {{ localError || wallet.error }}
      </p>
    </section>
  </WalletAccessFrame>
</template>

<style scoped>
.unlock-mark {
  margin-bottom: 1.15rem;
  color: var(--accent);
}

.access-error {
  color: var(--danger) !important;
  font-size: 0.82rem;
}
</style>
