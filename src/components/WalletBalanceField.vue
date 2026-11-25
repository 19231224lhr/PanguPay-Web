<script setup lang="ts">
import { wt, wl, walletLocale } from '@/i18n/walletText'
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
    panel?: string
    assets?: WalletAssetBalance[]
    asset?: WalletAssetBalance
    loading?: boolean
    offline?: boolean
    updatedAt?: number
  }>(),
  {
    panel: undefined,
    asset: undefined,
    assets: () => [],
    loading: false,
    offline: false,
    updatedAt: 0,
  },
)

const emit = defineEmits<{ refresh: []; send: [] }>()
const expanded = computed(() => props.panel === 'send' || props.panel === 'receive')
const total = computed(() => props.asset?.total ?? '0')
const updatedTime = computed(() =>
  props.updatedAt ? new Date(props.updatedAt).toLocaleTimeString(walletLocale()) : '',
)
const syncStatus = computed(() => {
  if (props.loading) return wt('w382')
  if (props.offline) return wt('w380')
  return props.updatedAt ? wt('w126') : wt('w383')
})
const updatedLabel = computed(() => {
  if (!props.updatedAt) return wt('w378')
  return `${props.offline ? wt('refinement8') : wt('refinement9')} ${updatedTime.value}`
})
</script>

<template>
  <section
    class="overview-panel wallet-balance-field"
    :class="{ 'balance-expanded': expanded }"
    :aria-label="wt('refinement10')"
  >
    <slot />
    <header v-if="!expanded" class="overview-panel__heading">
      <h2 id="wallet-total-assets">{{ wt('refinement10') }}</h2>
    </header>
    <div class="overview-panel__body">
      <div class="balance-copy" :class="{ 'overview-summary-metrics': expanded }">
        <div class="balance-total" :class="{ 'overview-summary-metrics__primary': expanded }">
          <span v-if="expanded" class="balance-caption">{{ wt('refinement10') }}</span>
          <strong class="wallet-balance-field__amount tabular"
            >{{ updatedAt ? total : '—' }} <small>{{ asset?.symbol ?? 'CAL' }}</small></strong
          >
          <p v-if="!expanded || (asset?.name && asset.name !== asset.symbol)" class="balance-name">
            {{ wl(asset?.name) }}
          </p>
        </div>
        <div class="wallet-balance-field__composition" :aria-label="wt('w381')">
          <span
            ><small>{{ wt('w205') }}</small
            ><b class="tabular">{{ updatedAt ? (asset?.utxoAvailable ?? '0') : '—' }}</b></span
          >
          <span
            ><small>{{ wt('w206') }}</small
            ><b class="tabular">{{ updatedAt ? (asset?.txCerSpendable ?? '0') : '—' }}</b></span
          >
        </div>
      </div>
      <WalletMoneyFigure />
    </div>
    <div v-if="assets.length > 1" class="other-assets" :aria-label="wt('refinement11')">
      <div v-for="item in assets.slice(1)" :key="item.symbol">
        <span>{{ wl(item.name) }} · {{ item.symbol }}</span
        ><b>{{ item.total }}</b>
        <small>UTXO {{ item.utxoAvailable }} · TXCer {{ item.txCerSpendable }}</small>
      </div>
    </div>
    <footer class="balance-footer">
      <button
        class="balance-sync"
        type="button"
        :title="updatedLabel"
        :aria-label="updatedLabel + wt('refinement12')"
        :aria-busy="loading || undefined"
        :disabled="loading"
        @click="emit('refresh')"
      >
        <ArrowClockwise :class="{ 'is-spinning': loading }" :size="14" aria-hidden="true" />
        <span>{{ syncStatus }}</span>
        <span v-if="updatedTime" class="tabular">{{ updatedTime }}</span>
      </button>
      <div v-if="!expanded" class="wallet-balance-field__actions" :aria-label="wt('w384')">
        <AppButton
          data-send-trigger
          aria-expanded="false"
          aria-controls="overview-send"
          @click="emit('send')"
          ><PaperPlaneTilt :size="15" aria-hidden="true" />{{ wt('w210') }}</AppButton
        >
        <AppButton
          to="/wallet#receive"
          aria-expanded="false"
          aria-controls="detail-receive"
          variant="secondary"
          ><ArrowDown :size="15" aria-hidden="true" />{{ wt('w139') }}</AppButton
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
  width: fit-content;
  max-width: 100%;
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
.balance-expanded .balance-footer {
  justify-content: flex-start;
  gap: 0.65rem;
  min-height: 32px;
}
.balance-expanded .balance-sync {
  min-height: 32px;
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
