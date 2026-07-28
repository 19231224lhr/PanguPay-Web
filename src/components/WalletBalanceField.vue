<script setup lang="ts">
import {
  PhArrowClockwise as ArrowClockwise,
  PhArrowDown as ArrowDown,
  PhPaperPlaneTilt as PaperPlaneTilt,
} from '@phosphor-icons/vue'
import { computed } from 'vue'

import type { WalletAssetBalance } from '@/wallet/types'
import AppButton from './AppButton.vue'

const props = withDefaults(
  defineProps<{
    animate?: boolean
    asset?: WalletAssetBalance
    loading?: boolean
    offline?: boolean
    updatedAt?: number
  }>(),
  {
    animate: false,
    asset: undefined,
    loading: false,
    offline: false,
    updatedAt: 0,
  },
)

const emit = defineEmits<{ refresh: []; sweepEnd: [] }>()
const total = computed(() => props.asset?.total ?? '0')
const updatedLabel = computed(() => {
  if (!props.updatedAt) return '尚未取得真实账户快照'
  return `${props.offline ? '缓存于' : '同步于'} ${new Date(props.updatedAt).toLocaleTimeString()}`
})
</script>

<template>
  <section
    class="wallet-balance-field"
    :class="{ 'wallet-balance-field--sweep': animate }"
    aria-labelledby="wallet-total-assets"
  >
    <div class="wallet-balance-field__main">
      <div class="wallet-balance-field__label">
        <p id="wallet-total-assets">总资产</p>
        <span v-if="offline">离线快照</span>
      </div>

      <strong class="wallet-balance-field__amount tabular">
        {{ total }}
        <small>{{ asset?.symbol ?? 'PGC' }}</small>
      </strong>

      <div class="wallet-balance-field__composition" aria-label="资产可用组成">
        <span>
          <small>UTXO 可用</small>
          <b class="tabular">{{ asset?.utxoAvailable ?? '0' }}</b>
        </span>
        <span>
          <small>TXCer 可支付</small>
          <b class="tabular">{{ asset?.txCerSpendable ?? '0' }}</b>
        </span>
      </div>

      <div class="wallet-balance-field__sync">
        <span>{{ updatedLabel }}</span>
        <button type="button" :aria-busy="loading || undefined" @click="emit('refresh')">
          <ArrowClockwise :class="{ 'is-spinning': loading }" :size="16" aria-hidden="true" />
          {{ loading ? '同步中' : '同步' }}
        </button>
      </div>
    </div>

    <div class="wallet-balance-field__actions" aria-label="钱包操作">
      <AppButton to="/wallet/send" size="large">
        <PaperPlaneTilt :size="18" weight="bold" aria-hidden="true" />
        发送
      </AppButton>
      <AppButton to="/wallet/receive" size="large" variant="secondary">
        <ArrowDown :size="18" weight="bold" aria-hidden="true" />
        收款
      </AppButton>
    </div>

    <i class="wallet-balance-field__sweep" aria-hidden="true" @animationend="emit('sweepEnd')" />
  </section>
</template>

<style scoped>
.wallet-balance-field {
  position: relative;
  display: grid;
  min-height: 270px;
  align-items: end;
  overflow: hidden;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(1.5rem, 4vw, 3rem);
  border-radius: var(--radius-xl);
  background: var(--value-field-surface);
  isolation: isolate;
}

.wallet-balance-field::after {
  position: absolute;
  z-index: -1;
  top: -38%;
  right: -12%;
  width: min(520px, 52vw);
  aspect-ratio: 1.25;
  border-radius: 50%;
  background: radial-gradient(circle, var(--hero-halo), transparent 68%);
  content: '';
  filter: blur(20px);
  opacity: 0.6;
}

.wallet-balance-field__main {
  display: grid;
  min-width: 0;
  gap: 0.9rem;
}

.wallet-balance-field__label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.wallet-balance-field__label p,
.wallet-balance-field__label span {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.76rem;
}

.wallet-balance-field__label span {
  padding: 0.22rem 0.5rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--warning) 10%, transparent);
  color: var(--warning);
}

.wallet-balance-field__amount {
  overflow: hidden;
  font-size: clamp(4.4rem, 7vw, 6rem);
  font-weight: 540;
  letter-spacing: -0.04em;
  line-height: 0.94;
  text-overflow: ellipsis;
}

.wallet-balance-field__amount small {
  margin-left: 0.25em;
  color: var(--text-muted);
  font-size: 0.18em;
  font-weight: 620;
  letter-spacing: 0.02em;
}

.wallet-balance-field__composition {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 2rem;
}

.wallet-balance-field__composition span {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
}

.wallet-balance-field__composition small {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.wallet-balance-field__composition b {
  font-size: 0.78rem;
  font-weight: 620;
}

.wallet-balance-field__sync {
  display: flex;
  min-height: 32px;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.7rem;
}

.wallet-balance-field__sync button {
  display: inline-flex;
  min-height: 32px;
  align-items: center;
  gap: 0.35rem;
  padding-inline: 0.5rem;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.wallet-balance-field__sync button:hover {
  background: var(--surface-hover);
  color: var(--text);
}

.wallet-balance-field__sync svg.is-spinning {
  animation: wallet-sync-spin 720ms linear infinite;
}

.wallet-balance-field__actions {
  display: grid;
  width: 316px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.7rem;
}

.wallet-balance-field__actions :deep(.app-button) {
  min-width: 0;
}

.wallet-balance-field__actions :deep(.app-button--secondary) {
  border-color: transparent;
  background: color-mix(in srgb, var(--surface-raised) 72%, transparent);
}

.wallet-balance-field__sweep {
  position: absolute;
  inset: 0 auto 0 -32%;
  width: 28%;
  opacity: 0;
  background: linear-gradient(
    90deg,
    transparent,
    color-mix(in srgb, var(--accent) 13%, transparent),
    transparent
  );
  filter: blur(8px);
  pointer-events: none;
  transform: translateX(0);
}

.wallet-balance-field--sweep .wallet-balance-field__sweep {
  animation: wallet-balance-sweep 650ms var(--ease-standard) both;
}

@keyframes wallet-balance-sweep {
  20% {
    opacity: 0.74;
  }

  100% {
    opacity: 0;
    transform: translateX(510%);
  }
}

@keyframes wallet-sync-spin {
  to {
    transform: rotate(1turn);
  }
}

@media (max-width: 760px) {
  .wallet-balance-field {
    min-height: 330px;
    grid-template-columns: 1fr;
    gap: 1.7rem;
  }

  .wallet-balance-field__actions {
    width: 100%;
  }
}

@media (max-width: 440px) {
  .wallet-balance-field {
    padding: 1.4rem;
  }

  .wallet-balance-field__amount {
    font-size: clamp(3.35rem, 16vw, 4.2rem);
  }

  .wallet-balance-field__composition {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.65rem;
  }

  .wallet-balance-field__composition span {
    display: grid;
    gap: 0.22rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .wallet-balance-field--sweep .wallet-balance-field__sweep,
  .wallet-balance-field__sync svg.is-spinning {
    animation: none;
  }
}
</style>
