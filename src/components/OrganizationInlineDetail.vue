<script setup lang="ts">
import { groupedPledgeAmount } from '@/i18n/pledgeAmount'
import { computed } from 'vue'

import AppButton from '@/components/AppButton.vue'
import WalletPagedRows from '@/components/WalletPagedRows.vue'
import { wCount, wt } from '@/i18n/walletText'
import type { WalletEntryOrganizationDetail } from '@/wallet/entryService'

const props = defineProps<{
  detail?: WalletEntryOrganizationDetail
  busy: boolean
  error: string
}>()
defineEmits<{ retry: [] }>()

const groups = computed(() =>
  [
    {
      role: 'assign',
      title: wt('w67'),
      description: wt('w68'),
      endpointAvailable: props.detail?.assignAvailable,
    },
    {
      role: 'aggregation',
      title: wt('w69'),
      description: wt('w70'),
      endpointAvailable: props.detail?.aggregationAvailable,
    },
    { role: 'txcer', title: wt('w71'), description: wt('w72') },
    { role: 'guarantor', title: wt('w93'), description: wt('w73') },
  ].map((group) => ({
    ...group,
    nodes: props.detail?.nodes.filter((node) => node.role === group.role) ?? [],
  })),
)

function nodeStatus(status?: string): string {
  if (!status) return wt('w75')
  const normalized = status.toLowerCase()
  if (['active', 'online', 'ready'].includes(normalized)) return wt('w76')
  if (['standby', 'pending'].includes(normalized)) return wt('w77')
  if (['disabled', 'revoked', 'offline'].includes(normalized)) return wt('w78')
  return status
}

</script>

<template>
  <section class="organization-detail" role="region" :aria-busy="busy">
    <p v-if="busy && !detail" role="status">{{ wt('w321') }}</p>
    <div v-if="error" class="detail-error" role="alert">
      <p>{{ detail ? wt('networkCachedData') : wt('w323') }}</p>
      <AppButton variant="ghost" :disabled="busy" @click="$emit('retry')">{{
        wt('w324')
      }}</AppButton>
    </div>
    <template v-if="detail">
      <dl class="detail-metrics">
        <div>
          <dt>{{ wt('w92') }}</dt>
          <dd>{{ groupedPledgeAmount(detail.pledgeAmount) }}</dd>
        </div>
        <div>
          <dt>{{ wt('w327') }}</dt>
          <dd>{{ detail.guarantorCount }} {{ wCount('w328', detail.guarantorCount) }}</dd>
        </div>
        <div>
          <dt>{{ wt('w329') }}</dt>
          <dd>{{ detail.certifierCount }} {{ wCount('w330', detail.certifierCount) }}</dd>
        </div>
      </dl>
      <div class="detail-nodes">
        <h3>{{ wt('w98') }}</h3>
        <details v-for="group in groups" :key="group.role">
          <summary>
            {{ group.title }} <span class="detail-count">{{ group.nodes.length }}</span>
            <small v-if="group.endpointAvailable !== undefined" class="endpoint-status">{{
              group.endpointAvailable ? wt('orgEndpointPresent') : wt('orgEndpointMissing')
            }}</small>
          </summary>
          <p>{{ group.description }}</p>
          <WalletPagedRows v-if="group.nodes.length" v-slot="{ rows }" :items="group.nodes" :label="group.title">
            <ul>
              <li v-for="node in rows" :key="node.id || node.peerId || node.endpoint">
                <div class="node-identity">
                  <strong>{{ node.id || group.title }}</strong>
                  <small>{{ nodeStatus(node.status) }}</small>
                </div>
                <small v-if="node.peerId" class="mono">Peer · {{ node.peerId }}</small>
                <small v-if="node.endpoint" class="mono">API · {{ node.endpoint }}</small>
              </li>
            </ul>
          </WalletPagedRows>
          <p v-else>{{ wt('w100') }}</p>
        </details>
      </div>
      <details class="detail-technical">
        <summary>{{ wt('w101') }}</summary>
        <dl>
          <div>
            <dt>{{ wt('w47') }}</dt>
            <dd>{{ detail.id }}</dd>
          </div>
          <div v-if="detail.peerGroupId">
            <dt>{{ wt('w102') }}</dt>
            <dd>{{ detail.peerGroupId }}</dd>
          </div>
          <div v-if="detail.pledgeAddress">
            <dt>{{ wt('w103') }}</dt>
            <dd>{{ detail.pledgeAddress }}</dd>
          </div>
          <div v-if="detail.assignEndpoint">
            <dt>Assign</dt>
            <dd>{{ detail.assignEndpoint }}</dd>
          </div>
          <div v-if="detail.aggregationEndpoint">
            <dt>Aggregation</dt>
            <dd>{{ detail.aggregationEndpoint }}</dd>
          </div>
        </dl>
      </details>
    </template>
  </section>
</template>

<style scoped>
.organization-detail {
  display: grid;
  gap: 0.8rem;
  min-width: 0;
  padding: 0.9rem;
  border-top: 1px solid var(--hairline);
  background: color-mix(in srgb, var(--surface-raised) 45%, var(--surface));
  color: var(--text);
  overflow-wrap: anywhere;
}
h3,
p,
dl,
dd,
ul {
  margin: 0;
}
.detail-metrics {
  display: grid;
  gap: 0.35rem;
}
dl > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
  align-items: baseline;
  gap: 0.6rem;
}
dt,
small,
p {
  color: var(--text-muted);
  font-size: 0.76rem;
  line-height: 1.5;
}
dd {
  font-size: 0.83rem;
  font-weight: 580;
  text-align: end;
  font-variant-numeric: tabular-nums;
}
h3 {
  padding-block: 0.3rem;
  font-size: 0.84rem;
  font-weight: 620;
}
details {
  border-top: 1px solid var(--hairline);
}
summary {
  min-height: 44px;
  align-content: center;
  font-size: 0.79rem;
  cursor: pointer;
}
summary::marker {
  color: var(--text-muted);
}
summary:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}
.endpoint-status {
  margin-inline-start: 0.65rem;
}
.detail-count {
  margin-inline-start: 0.35rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
details p {
  padding-bottom: 0.5rem;
}
ul {
  display: grid;
  gap: 0.35rem;
  padding: 0 0 0.7rem;
  list-style: none;
}
li {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
}
.node-identity,
.detail-error {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}
.node-identity strong {
  font-size: 0.8rem;
}
.mono,
.detail-technical dd {
  font-family: var(--font-mono);
  font-size: 0.71rem;
}
.detail-technical dl {
  display: grid;
  gap: 0.4rem;
}
.detail-technical {
  margin-top: -0.8rem;
}
.detail-error {
  align-items: center;
}
.detail-error p {
  color: var(--danger);
}
</style>
