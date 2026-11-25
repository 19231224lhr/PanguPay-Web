<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import { PhCheck, PhClock, PhX, PhMinus } from '@phosphor-icons/vue'
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
    { key: 'fast', label: wt('w310'), detail: 'FastEvidence', state: fast },
    { key: 'liability', label: wt('w311'), detail: 'AssignAck + Receipt', state: liability },
    { key: 'cfaa', label: wt('w186'), detail: 'CFAA', state: cfaa },
  ]
})

const stateLabel = (state: TrustState) =>
  ({ verified: wt('w312'), pending: wt('w313'), failed: wt('w314'), unavailable: wt('w315') })[
    state
  ]
</script>

<template>
  <div class="trust-path" :aria-label="wt('w316')">
    <div
      v-for="step in steps"
      :key="step.key"
      :data-trust-step="step.key"
      :data-state="step.state"
      class="trust-path__step"
    >
      <span class="trust-mark" aria-hidden="true"
        ><component
          :is="
            { verified: PhCheck, pending: PhClock, failed: PhX, unavailable: PhMinus }[step.state]
          "
          :size="12"
          weight="bold"
      /></span>
      <b :title="step.detail">{{ step.label }}</b>
      <small>{{ stateLabel(step.state) }}</small>
    </div>
    <p
      v-if="
        credential.cfaaAuditStatus === 'Pending' || credential.cfaaAuditStatus === 'Unavailable'
      "
    >
      {{ wt('w317') }}
    </p>
  </div>
</template>

<style scoped>
.trust-path {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 10px;
  row-gap: 6px;
}
.trust-path__step {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: center;
  gap: 4px 6px;
  min-width: 0;
}
.trust-mark {
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  color: var(--text-muted);
  background: var(--surface-subtle);
}
[data-state='verified'] .trust-mark {
  color: var(--wallet-selection-ink, var(--accent));
  background: color-mix(in srgb, var(--accent) 10%, transparent);
}
[data-state='pending'] .trust-mark {
  color: var(--warning);
}
[data-state='failed'] .trust-mark {
  color: var(--danger);
}
.trust-path__step b {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.77rem;
  font-weight: 560;
}
.trust-path__step:not(:last-of-type) b::after {
  content: '';
  height: 1px;
  flex: 1;
  background: var(--border);
}
.trust-path__step small {
  grid-column: 2;
  color: var(--text-muted);
  font-size: 0.68rem;
}
.trust-path p {
  grid-column: 1/-1;
  margin: 2px 0;
  color: var(--text-muted);
  font-size: 0.7rem;
}
@container (max-width:350px) {
  .trust-path {
    column-gap: 5px;
  }
  .trust-path__step {
    column-gap: 4px;
  }
}
</style>
