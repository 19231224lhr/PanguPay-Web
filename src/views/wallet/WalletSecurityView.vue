<script setup lang="ts">
import { wCount, wt } from '@/i18n/walletText'

import { PhCaretDown, PhWallet, PhArrowsLeftRight, PhCertificate } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import AppSelect from '@/components/AppSelect.vue'
import CredentialTrustPath from '@/components/CredentialTrustPath.vue'
import ExposureShareBar from '@/components/ExposureShareBar.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { isActiveCredentialFailure } from '@/wallet/credentials'

const dashboard = useDashboardStore()
function lifecycleLabel(value: string) {
  if (value === 'ConvertedToUTXO') return wt('credentialConverted')
  if (value === 'Active') return wt('credentialActive')
  return value
}
const selectedState = ref('')
const states = computed(() => [
  ...new Set(dashboard.current.credentials.map((item) => item.lifecycle)),
])
const stateOptions = computed(() => [
  { label: wt('w130'), value: '' },
  ...states.value.map((value) => ({ label: lifecycleLabel(value), value })),
])
watch(states, (values) => {
  if (!values.some((value) => value === selectedState.value)) selectedState.value = ''
})
const visibleCredentials = computed(() =>
  dashboard.current.credentials.filter(
    (item) => !selectedState.value || item.lifecycle === selectedState.value,
  ),
)
</script>

<template>
  <div class="wallet-page wallet-refined security-page">
    <Teleport v-if="$slots['header-action']" defer to="#intro-security">
      <slot name="header-action" />
    </Teleport>
    <WalletPageHeader v-else :title="wt('w177')" />
    <section
      v-if="!$slots['header-action']"
      class="wallet-section"
      aria-labelledby="security-summary-heading"
    >
      <div class="detail-page-intro">
        <div class="detail-page-intro__copy">
          <h2 id="security-summary-heading">{{ wt('w179') }}</h2>
          <StatusLabel :tone="dashboard.current.security.isolatedCount ? 'danger' : 'success'">
            {{ dashboard.current.security.isolatedCount ? wt('w180') : wt('w181') }}
          </StatusLabel>
        </div>
        <WalletFigure kind="stack" :intensity="0.3" />
      </div>
      <dl class="security-metrics">
        <div>
          <dt>{{ wt('w182') }}</dt>
          <dd class="tabular">{{ dashboard.current.security.spendReady }} CAL</dd>
        </div>
        <div>
          <dt>{{ wt('w183') }}</dt>
          <dd>
            {{ dashboard.current.security.isolatedCount ? wt('w184') : wt('w185') }}
          </dd>
        </div>
        <div>
          <dt>{{ wt('w186') }}</dt>
          <dd class="tabular">
            {{ dashboard.current.security.pendingAudits }} {{ wt('refinement47') }}
            <small>{{ wt('refinement48') }}</small>
          </dd>
        </div>
        <div>
          <dt>{{ wt('w188') }}</dt>
          <dd class="tabular">{{ dashboard.current.security.isolatedCount }} {{ wCount('w189', dashboard.current.security.isolatedCount) }}</dd>
        </div>
      </dl>
    </section>
    <section class="wallet-section" aria-labelledby="security-credentials-heading">
      <div class="wallet-section__heading">
        <div class="credential-toolbar">
          <h2 id="security-credentials-heading">{{ wt('w194') }}</h2>
          <AppSelect
            v-if="states.length > 1"
            id="credential-state"
            v-model="selectedState"
            inline
            :label="wt('credentialStateFilter')"
            :options="stateOptions"
          />
        </div>
        <span class="detail-page-caption"
          >{{ visibleCredentials.length }} {{ wCount('refinement40', visibleCredentials.length) }}</span
        >
      </div>
      <div v-if="!dashboard.current.credentials.length" class="wallet-empty">
        <strong>{{ wt('refinement49') }}</strong>
        <p>{{ wt('refinement50') }}</p>
      </div>
      <details
        v-for="credential in visibleCredentials"
        v-else
        :key="credential.recordId || credential.txCerId"
        class="credential"
      >
        <summary class="security-record credential-summary">
          <span class="wallet-record-icon" aria-hidden="true">
            <PhCertificate :size="20" weight="duotone" />
          </span>
          <span class="security-record__identity">
            <strong class="credential-amount">{{ credential.amount }} <small>CAL</small></strong>
            <span v-if="credential.txCerId" class="credential-id" :title="credential.txCerId"
              >TXCer ID
              <code>{{
                credential.txCerId.length > 18
                  ? credential.txCerId.slice(0, 8) + '…' + credential.txCerId.slice(-6)
                  : credential.txCerId
              }}</code>
            </span>
          </span>
          <span
            class="credential-lifecycle"
            :class="{ 'has-error': isActiveCredentialFailure(credential) }"
            :title="credential.lifecycle"
          >
            <PhArrowsLeftRight
              v-if="credential.lifecycle === 'ConvertedToUTXO'"
              :size="14"
              aria-hidden="true"
            />
            {{
              isActiveCredentialFailure(credential)
                ? wt('w184')
                : lifecycleLabel(credential.lifecycle)
            }}
          </span>
          <span class="credential-toggle">
            <span class="when-closed">{{ wt('w51') }}</span>
            <span class="when-open">{{ wt('w365') }}</span>
          </span>
          <PhCaretDown :size="13" aria-hidden="true" />
        </summary>
        <div class="credential-body">
          <CredentialTrustPath :credential="credential" />
          <ExposureShareBar :shares="credential.exposureShares" />
          <p v-if="credential.error" class="credential__error">
            {{
              credential.lifecycle === 'Active' ? credential.error : wt('w196', [credential.error])
            }}
          </p>
          <details>
            <summary>{{ wt('w197') }} <PhCaretDown :size="12" aria-hidden="true" /></summary>
            <dl class="wallet-detail-list">
              <div>
                <dt>FastEvidence</dt>
                <dd>{{ credential.fastEvidenceStatus }}</dd>
              </div>
              <div>
                <dt>AssignAck / LiabilityReceipt</dt>
                <dd>
                  {{ credential.hasAssignAck ? wt('w198') : wt('w199') }} /
                  {{ credential.hasLiabilityReceipt ? wt('w198') : wt('w199') }}
                </dd>
              </div>
              <div>
                <dt>{{ wt('w200') }}</dt>
                <dd>{{ credential.cfaaAuditStatus }}</dd>
              </div>
              <div>
                <dt>ExposureShares</dt>
                <dd>
                  {{ credential.exposureShares.length }} {{ wCount('w201', credential.exposureShares.length) }}
                  {{ credential.rootIds.length }} {{ wCount('w202', credential.rootIds.length) }}
                </dd>
              </div>
              <div>
                <dt>TXCerID</dt>
                <dd>{{ credential.txCerId }}</dd>
              </div>
              <div>
                <dt>RecordID</dt>
                <dd>{{ credential.recordId }}</dd>
              </div>
              <div v-for="share in credential.exposureShares" :key="share.leafId">
                <dt>{{ share.rootId }}</dt>
                <dd>{{ share.amount }} CAL · {{ share.leafId }}</dd>
              </div>
            </dl>
          </details>
        </div>
      </details>
    </section>
    <section class="wallet-section security-addresses" aria-labelledby="security-addresses-heading">
      <div class="wallet-section__heading">
        <h2 id="security-addresses-heading">{{ wt('w203') }}</h2>
        <span class="detail-page-caption"
          >{{ dashboard.current.addresses.length }} {{ wCount('refinement2', dashboard.current.addresses.length) }}</span
        >
      </div>
      <details v-for="(address, index) in dashboard.current.addresses" :key="address.address">
        <summary class="security-record address-summary">
          <span class="wallet-record-icon" aria-hidden="true">
            <PhWallet :size="20" weight="duotone" />
          </span>
          <span class="security-record__identity">
            <strong>{{ wt('w516', [index + 1]) }}</strong>
            <code>{{
              address.address.length > 20
                ? address.address.slice(0, 9) + '…' + address.address.slice(-7)
                : address.address
            }}</code>
          </span>
          <PhCaretDown :size="13" aria-hidden="true" />
        </summary>
        <dl class="wallet-detail-list">
          <div>
            <dt>{{ wt('w144') }}</dt>
            <dd>{{ address.address }}</dd>
          </div>
          <div>
            <dt>{{ wt('w204') }}</dt>
            <dd>{{ address.type }}</dd>
          </div>
          <div>
            <dt>{{ wt('w205') }}</dt>
            <dd>{{ address.balance }}</dd>
          </div>
          <div>
            <dt>{{ wt('w206') }}</dt>
            <dd>{{ address.txCerBalance }}</dd>
          </div>
          <div>
            <dt>ExposureShares / RootID</dt>
            <dd>{{ wt('w207') }}</dd>
          </div>
        </dl>
      </details>
    </section>
    <details class="protocol-summary">
      <summary>{{ wt('w190') }} <PhCaretDown :size="12" aria-hidden="true" /></summary>
      <dl class="wallet-detail-list">
        <div>
          <dt>FastEvidence / AssignAck</dt>
          <dd>{{ wt('w191') }}</dd>
        </div>
        <div>
          <dt>LiabilityReceipt</dt>
          <dd>{{ wt('w192') }}</dd>
        </div>
        <div>
          <dt>CFAA</dt>
          <dd>{{ wt('w193') }}</dd>
        </div>
      </dl>
    </details>
  </div>
</template>

<style scoped>
.credential-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 10px;
}
.security-page > .protocol-summary > summary,
.credential-body > details > summary {
  color: var(--wallet-selection-ink, var(--accent));
  min-height: 42px;
}
.credential-amount {
  font-size: 1.35rem;
  font-weight: 610;
  font-variant-numeric: tabular-nums;
}
.credential-amount small {
  font-size: 0.74rem;
  font-weight: 500;
  color: var(--text-muted);
}
.credential-lifecycle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 0.75rem;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}
.credential-lifecycle.has-error {
  color: var(--danger);
}
.security-page summary {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  list-style: none;
}
.security-page summary::-webkit-details-marker {
  display: none;
}
.security-page summary > svg:last-child {
  flex: none;
  transition: transform 160ms ease;
}
.security-page details[open] > summary > svg:last-child {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .security-page summary > svg:last-child {
    transition: none;
  }
}
.security-page .credential-body > details {
  border: 0;
}
.security-page .credential-body > details > summary {
  min-height: 32px;
}
.address-summary strong {
  color: var(--text);
  font-size: 0.79rem;
  font-weight: 570;
}
.address-summary code {
  color: var(--text-muted);
  font: 0.68rem/1.45 var(--font-mono);
}
details {
  border-top: 1px solid var(--hairline);
}

summary {
  min-height: 52px;
  align-content: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.protocol-summary {
  margin-top: 0.25rem;
}

.security-page .security-record {
  min-height: 66px;
  padding: 6px 10px;
  gap: clamp(5px, 1.3vw, 16px);
  color: var(--text);
}
.security-record__identity {
  display: grid;
  gap: 2px;
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.credential-id {
  font-size: 0.68rem;
  line-height: 1.45;
  color: var(--text-muted);
}
.credential-id code {
  font-family: var(--font-mono);
}
@container (max-width: 460px) {
  .security-page .security-record {
    column-gap: 7px;
    padding-inline: 2px;
  }
  .security-page .credential-summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto auto;
    row-gap: 2px;
  }
  .credential-summary .wallet-record-icon,
  .credential-summary .security-record__identity {
    grid-row: 1 / 3;
  }
  .security-page .credential-summary .credential-lifecycle {
    grid-column: 3 / 5;
    max-width: none;
    justify-self: end;
  }
  .credential-toggle {
    grid-column: 3;
    justify-self: end;
  }
}
.credential-summary .credential-lifecycle {
  max-width: 45%;
}
.credential-toggle,
.credential-summary > svg {
  color: var(--wallet-selection-ink, var(--accent));
}
.credential-toggle {
  white-space: nowrap;
}
.credential:not([open]) .when-open,
.credential[open] .when-closed {
  display: none;
}
.credential-body {
  display: grid;
  gap: 14px;
  padding: 6px 0 14px;
}
.credential:first-of-type {
  border-top: 0;
}
.credential__error {
  margin: 0;
  color: var(--warning);
}
</style>
