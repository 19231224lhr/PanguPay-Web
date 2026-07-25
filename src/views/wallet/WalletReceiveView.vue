<script setup lang="ts">
import { PhCheck as Check, PhCopy as Copy } from '@phosphor-icons/vue'
import { ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const selected = ref(wallet.addresses[0]?.address ?? '')
const copied = ref(false)

async function copyAddress(): Promise<void> {
  if (!selected.value) return
  await navigator.clipboard.writeText(selected.value)
  copied.value = true
  setTimeout(() => (copied.value = false), 1400)
}
</script>

<template>
  <div class="wallet-page receive-page">
    <WalletPageHeader
      title="收款"
      description="选择一个由当前 RootSeed 确定性恢复的真实地址。复制时不会暴露 RootSeed 或私钥。"
    />
    <section class="wallet-surface receive-card">
      <label>
        <span>收款地址</span>
        <select v-model="selected">
          <option
            v-for="address in wallet.addresses"
            :key="address.address"
            :value="address.address"
          >
            PGC · {{ address.address }}
          </option>
        </select>
      </label>
      <output class="receive-address">{{ selected || '钱包中没有可用地址' }}</output>
      <AppButton size="large" :disabled="!selected" @click="copyAddress">
        <component :is="copied ? Check : Copy" :size="19" />
        {{ copied ? '已复制' : '复制地址' }}
      </AppButton>
    </section>
  </div>
</template>

<style scoped>
.receive-page {
  width: min(760px, 100%);
}

.receive-card {
  display: grid;
  gap: 1rem;
}

label {
  display: grid;
  gap: 0.48rem;
  font-size: 0.82rem;
  font-weight: 650;
}

select {
  min-height: 48px;
  padding: 0 0.82rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-raised);
}

.receive-address {
  padding: clamp(1.2rem, 4vw, 2.2rem);
  border-radius: var(--radius-lg);
  background: var(--surface-subtle);
  font-family: var(--font-mono);
  font-size: clamp(0.78rem, 2vw, 1rem);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.app-button {
  justify-self: start;
}
</style>
