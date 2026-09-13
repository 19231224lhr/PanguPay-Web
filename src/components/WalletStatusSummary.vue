<script setup lang="ts">
import { wt } from '@/i18n/walletText'

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
      title: wt('w385'),
      detail: wt('w386'),
      tone: 'warning',
    }
  }
  if (props.security.isolatedCount > 0) {
    return {
      icon: WarningCircle,
      title: wt('w387', [props.security.isolatedCount]),
      detail: wt('w388'),
      tone: 'danger',
    }
  }
  return {
    icon: CheckCircle,
    title: wt('w389'),
    detail: wt('w390', [props.security.spendReady, props.security.pendingAudits]),
    tone: 'success',
  }
})
</script>

<template>
  <section
    class="wallet-status-summary"
    :class="`wallet-status-summary--${state.tone}`"
    role="region"
    :aria-label="wt('w391')"
  >
    <component :is="state.icon" :size="20" weight="regular" aria-hidden="true" />
    <span>
      <strong>{{ state.title }}</strong>
      <small>{{ state.detail }}</small>
    </span>
    <RouterLink to="/wallet/security"> {{ wt('w51') }} </RouterLink>
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
