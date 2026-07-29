<script setup lang="ts">
import { computed } from 'vue'

import type { WalletCredentialSummary } from '@/wallet/types'

const props = defineProps<{ credential: WalletCredentialSummary }>()

type TrustState = 'verified' | 'pending' | 'failed' | 'unavailable'

const steps = computed(() => {
  const fast = props.credential.fastEvidenceStatus.toLowerCase() as TrustState
  const liability: TrustState =
    fast === 'failed'
      ? 'failed'
      : fast === 'verified' && props.credential.hasAssignAck && props.credential.hasLiabilityReceipt
        ? 'verified'
        : 'pending'
  const cfaa = props.credential.cfaaAuditStatus.toLowerCase() as TrustState
  return [
    { key: 'fast', label: '快速证据', detail: 'FastEvidence', state: fast },
    { key: 'liability', label: '责任确认', detail: 'AssignAck + Receipt', state: liability },
    { key: 'cfaa', label: '后台审计', detail: 'CFAA', state: cfaa },
  ]
})

const stateLabel = (state: TrustState) =>
  ({ verified: '已验证', pending: '处理中', failed: '失败', unavailable: '暂不可用' })[state]
</script>

<template>
  <div class="trust-path" aria-label="TXCer 安全凭证链">
    <template v-for="(step, index) in steps" :key="step.key">
      <span v-if="index" class="trust-path__line" aria-hidden="true" />
      <div :data-trust-step="step.key" :data-state="step.state" class="trust-path__step">
        <i aria-hidden="true" />
        <span
          ><b>{{ step.label }}</b
          ><small>{{ step.detail }}</small></span
        >
        <em>{{ stateLabel(step.state) }}</em>
      </div>
    </template>
    <p
      v-if="
        credential.cfaaAuditStatus === 'Pending' || credential.cfaaAuditStatus === 'Unavailable'
      "
    >
      后台审计不阻塞可支付；快速证据明确失败时才会隔离 TXCer。
    </p>
  </div>
</template>

<style scoped>
.trust-path {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.55rem;
}

.trust-path__step {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.4rem 0.55rem;
  min-width: 0;
  padding: 0.75rem;
  border-radius: 13px;
  background: var(--surface-subtle);
  transition:
    background 180ms var(--ease-standard),
    color 180ms var(--ease-standard);
}

.trust-path__step > i {
  width: 9px;
  height: 9px;
  margin-top: 0.25rem;
  border-radius: 50%;
  background: var(--text-muted);
}

.trust-path__step[data-state='verified'] > i {
  background: var(--success);
}

.trust-path__step[data-state='pending'] > i {
  background: var(--accent);
}

.trust-path__step[data-state='failed'] > i {
  background: var(--danger);
}

.trust-path__step[data-state='unavailable'] > i {
  background: var(--warning);
}

.trust-path__step > span {
  display: grid;
  min-width: 0;
  gap: 0.12rem;
}

.trust-path__step b,
.trust-path__step em {
  font-size: 0.71rem;
}

.trust-path__step small,
.trust-path p {
  color: var(--text-muted);
  font-size: 0.66rem;
}

.trust-path__step em {
  grid-column: 2;
  color: var(--text-muted);
  font-style: normal;
}

.trust-path__line {
  display: none;
}

.trust-path p {
  grid-column: 1 / -1;
  margin: 0.1rem 0 0;
  line-height: 1.5;
}

@media (max-width: 680px) {
  .trust-path {
    grid-template-columns: 1fr;
    gap: 0.35rem;
  }
}
</style>
