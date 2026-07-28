<script setup lang="ts">
import {
  PhCheckCircle as CheckCircle,
  PhWarningCircle as WarningCircle,
  PhWifiSlash as WifiSlash,
} from '@phosphor-icons/vue'
import { computed } from 'vue'

import type { WalletSecuritySummary } from '@/wallet/types'

const props = defineProps<{
  offline: boolean
  security: WalletSecuritySummary
}>()

const state = computed(() => {
  if (props.offline) {
    return {
      icon: WifiSlash,
      title: '账户快照离线',
      detail: '当前显示上次同步的数据',
      tone: 'warning',
    }
  }
  if (props.security.isolatedCount > 0) {
    return {
      icon: WarningCircle,
      title: `${props.security.isolatedCount} 份凭证需要处理`,
      detail: '相关 TXCer 已暂停支付',
      tone: 'danger',
    }
  }
  return {
    icon: CheckCircle,
    title: '资金状态正常',
    detail: `可立即支付 ${props.security.spendReady} PGC · ${props.security.pendingAudits} 项后台审计中`,
    tone: 'success',
  }
})
</script>

<template>
  <section
    class="wallet-status-summary"
    :class="`wallet-status-summary--${state.tone}`"
    role="region"
    aria-label="资金状态"
  >
    <component :is="state.icon" :size="20" weight="regular" aria-hidden="true" />
    <span>
      <strong>{{ state.title }}</strong>
      <small>{{ state.detail }}</small>
    </span>
    <RouterLink to="/wallet/security">查看详情</RouterLink>
  </section>
</template>

<style scoped>
.wallet-status-summary {
  --summary-color: var(--success);
  display: grid;
  min-height: 64px;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: 0.8rem;
  padding-block: 0.7rem;
  border-block: 1px solid var(--hairline);
}

.wallet-status-summary > svg {
  color: var(--summary-color);
}

.wallet-status-summary > span {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.65rem;
}

.wallet-status-summary strong {
  font-size: 0.82rem;
  font-weight: 620;
}

.wallet-status-summary small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.74rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wallet-status-summary a {
  min-height: 44px;
  align-content: center;
  color: var(--accent);
  font-size: 0.76rem;
}

.wallet-status-summary--warning {
  --summary-color: var(--warning);
}

.wallet-status-summary--danger {
  --summary-color: var(--danger);
}

@media (max-width: 620px) {
  .wallet-status-summary {
    align-items: start;
    grid-template-columns: auto 1fr;
  }

  .wallet-status-summary > span {
    display: grid;
    gap: 0.2rem;
  }

  .wallet-status-summary a {
    grid-column: 2;
    min-height: 32px;
  }

  .wallet-status-summary small {
    white-space: normal;
  }
}
</style>
