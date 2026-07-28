<script setup lang="ts">
import { PhCheck as Check, PhCopy as Copy } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import AppSelect from '@/components/AppSelect.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const selected = ref(wallet.addresses[0]?.address ?? '')
const copied = ref(false)
const addressOptions = computed(() =>
  wallet.addresses.map((address, index) => ({
    description: address.address,
    label: `PGC · 地址 ${index + 1}`,
    monospace: true,
    value: address.address,
  })),
)

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
    <section class="wallet-form-plane receive-card">
      <AppSelect
        id="receive-address"
        v-model="selected"
        label="收款地址"
        :options="addressOptions"
        empty-label="钱包中没有可用地址"
      />
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

.receive-address {
  padding: clamp(1.2rem, 4vw, 2.2rem);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  font-family: var(--font-mono);
  font-size: clamp(0.78rem, 2vw, 1rem);
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.app-button {
  justify-self: start;
}

@media (max-width: 599px) {
  .app-button {
    width: 100%;
  }
}
</style>
