<script setup lang="ts">
import {
  PhArrowClockwise as ArrowClockwise,
  PhArrowDown as ArrowDown,
  PhPaperPlaneTilt as PaperPlaneTilt,
} from '@phosphor-icons/vue'
import { computed } from 'vue'

import type { WalletAssetBalance } from '@/wallet/types'
import AppButton from './AppButton.vue'
import WalletMoneyFigure from './WalletMoneyFigure.vue'

const props = withDefaults(
  defineProps<{
    assets?: WalletAssetBalance[]
    asset?: WalletAssetBalance
    loading?: boolean
    offline?: boolean
    updatedAt?: number
  }>(),
  {
    asset: undefined,
    assets: () => [],
    loading: false,
    offline: false,
    updatedAt: 0,
  },
)

const emit = defineEmits<{ refresh: [] }>()
const total = computed(() => props.asset?.total ?? '0')
const updatedLabel = computed(() => {
  if (!props.updatedAt) return '尚未取得真实账户快照'
  return `${props.offline ? '缓存于' : '同步于'} ${new Date(props.updatedAt).toLocaleTimeString()}`
})
</script>

<template>
  <section class="overview-panel wallet-balance-field" aria-labelledby="wallet-total-assets">
    <header class="overview-panel__heading">
      <h2 id="wallet-total-assets">资产总览</h2>
      <span class="balance-state">{{
        offline ? '离线快照' : updatedAt ? '已同步' : '读取中'
      }}</span>
    </header>
    <div class="overview-panel__body">
      <div class="balance-copy">
        <strong class="wallet-balance-field__amount tabular"
          >{{ updatedAt ? total : '—' }} <small>{{ asset?.symbol ?? 'PGC' }}</small></strong
        >
        <p class="balance-name">{{ asset?.name }}</p>
        <div class="wallet-balance-field__composition" aria-label="资产可用组成">
          <span
            ><small>UTXO 可用</small
            ><b class="tabular">{{ updatedAt ? (asset?.utxoAvailable ?? '0') : '—' }}</b></span
          >
          <span
            ><small>TXCer 可支付</small
            ><b class="tabular">{{ updatedAt ? (asset?.txCerSpendable ?? '0') : '—' }}</b></span
          >
        </div>
      </div>
      <WalletMoneyFigure />
    </div>
    <div v-if="assets.length > 1" class="other-assets" aria-label="其他资产组成">
      <div v-for="item in assets.slice(1)" :key="item.symbol">
        <span>{{ item.name }} · {{ item.symbol }}</span
        ><b>{{ item.total }}</b>
        <small>UTXO {{ item.utxoAvailable }} · TXCer {{ item.txCerSpendable }}</small>
      </div>
    </div>
    <footer class="balance-footer">
      <button
        class="balance-sync"
        type="button"
        :title="updatedLabel"
        :aria-label="updatedLabel + '，同步账户'"
        :aria-busy="loading || undefined"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <ArrowClockwise :class="{ 'is-spinning': loading }" :size="14" aria-hidden="true" />
        <span>{{
          loading ? '同步中' : updatedAt ? new Date(updatedAt).toLocaleTimeString() : '同步'
        }}</span>
      </button>
      <div class="wallet-balance-field__actions" aria-label="钱包操作">
        <AppButton to="/wallet/send"
          ><PaperPlaneTilt :size="15" aria-hidden="true" />发送</AppButton
        >
        <AppButton to="/wallet/receive" variant="secondary"
          ><ArrowDown :size="15" aria-hidden="true" />收款</AppButton
        >
      </div>
    </footer>
  </section>
</template>

<style scoped>
.balance-copy {
  min-width: 0;
}
.wallet-balance-field__amount {
  display: block;
  overflow-wrap: anywhere;
  font-size: 2.25rem;
  font-weight: 600;
  letter-spacing: -0.025em;
  line-height: 1.1;
}
.wallet-balance-field__amount small {
  font-size: 0.8rem;
  color: var(--text-muted);
  font-weight: 500;
  letter-spacing: 0;
}
.balance-name {
  margin: 0.2rem 0 0.5rem;
  color: var(--text-muted);
  font-size: 0.7rem;
}
.balance-state {
  color: var(--text-muted);
  font-size: 0.7rem;
}
.wallet-balance-field__composition {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
}
.wallet-balance-field__composition span {
  display: inline-flex;
  align-items: baseline;
  gap: 0.4rem;
}
.wallet-balance-field__composition small {
  font-size: 0.7rem;
  color: var(--text-muted);
}
.wallet-balance-field__composition b {
  font-size: 0.75rem;
  font-weight: 500;
}
.balance-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
  margin-top: auto;
}
.balance-sync {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  min-height: 44px;
  padding: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.7rem;
  cursor: pointer;
}
.balance-sync:disabled {
  opacity: 0.5;
  cursor: wait;
}
.balance-sync:hover {
  color: var(--text);
}
.wallet-balance-field__actions {
  display: flex;
  gap: 0.5rem;
}
.wallet-balance-field__actions :deep(.app-button) {
  min-height: 36px;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  border-radius: 8px;
}
.other-assets {
  border-top: 1px solid var(--hairline);
  margin-block: 0.5rem;
}
.other-assets > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.25rem;
  font-size: 0.75rem;
  padding-block: 0.5rem;
}
.other-assets small {
  grid-column: 1 / -1;
  color: var(--text-muted);
}
.is-spinning {
  animation: wallet-sync-spin 720ms linear infinite;
}
@keyframes wallet-sync-spin {
  to {
    transform: rotate(1turn);
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-spinning {
    animation: none;
  }
}
@media (pointer: coarse) {
  .wallet-balance-field__actions :deep(.app-button) {
    min-height: 44px;
  }
}
</style>
