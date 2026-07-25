<script setup lang="ts">
import { computed, ref } from 'vue'

import AmountField from '@/components/AmountField.vue'
import FormField from '@/components/FormField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const mode = ref('quick')
const source = ref(wallet.addresses[0]?.address ?? '')
const recipient = ref('')
const amount = ref('')
const available = computed(() => dashboard.current.assets[0]?.total ?? '0')
</script>

<template>
  <div class="wallet-page send-page">
    <WalletPageHeader
      eyebrow="Phase 1 · 只读入口"
      title="发送"
      description="选择真实来源与转账模式。本阶段不会签名或提交交易，Phase 2 将接入普通、快速、跨链和混合转账。"
    />
    <section class="wallet-surface send-form">
      <SegmentedControl
        v-model="mode"
        label="转账模式"
        :options="[
          { label: '快速', value: 'quick' },
          { label: '普通', value: 'normal' },
          { label: '跨链', value: 'cross-chain' },
        ]"
      />
      <label class="select-field">
        <span>来源地址</span>
        <select v-model="source">
          <option
            v-for="address in wallet.addresses"
            :key="address.address"
            :value="address.address"
          >
            {{ address.address }}
          </option>
        </select>
      </label>
      <FormField
        id="send-recipient"
        v-model="recipient"
        label="收款地址"
        placeholder="输入完整地址"
      />
      <AmountField
        id="send-amount"
        v-model="amount"
        label="金额"
        asset="PGC"
        :help="`当前可支付 ${available} PGC`"
      />
      <p class="wallet-notice">
        已停留在安全预览阶段：此页面不会访问 submit-tx、submit-noguargroup-tx 或任何 GQNC 运维接口。
      </p>
      <button type="button" class="send-disabled" disabled>Phase 2 启用安全签名</button>
    </section>
  </div>
</template>

<style scoped>
.send-page {
  width: min(720px, 100%);
}

.send-form {
  display: grid;
  gap: 1.1rem;
}

.select-field {
  display: grid;
  gap: 0.48rem;
  font-size: 0.84rem;
  font-weight: 650;
}

select {
  min-height: 48px;
  padding: 0 0.82rem;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-md);
  outline: 0;
  background: var(--surface-raised);
}

.send-disabled {
  min-height: 50px;
  border-radius: 15px;
  background: var(--surface-subtle);
  color: var(--text-faint);
}
</style>
