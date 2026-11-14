<script setup lang="ts">
import { wt } from '@/i18n/walletText'

import CredentialTrustPath from '@/components/CredentialTrustPath.vue'
import ExposureShareBar from '@/components/ExposureShareBar.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { isActiveCredentialFailure } from '@/wallet/credentials'

const dashboard = useDashboardStore()
</script>

<template>
  <div class="wallet-page wallet-refined security-page">
    <WalletPageHeader :title="wt('w177')" :description="wt('w178')" />
    <section class="wallet-section" aria-labelledby="security-summary-heading">
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
          <dd class="tabular">{{ dashboard.current.security.isolatedCount }} {{ wt('w189') }}</dd>
        </div>
      </dl>
      <details class="protocol-summary">
        <summary>{{ wt('w190') }}</summary>
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
    </section>
    <section class="wallet-section" aria-labelledby="security-credentials-heading">
      <div class="wallet-section__heading">
        <h2 id="security-credentials-heading">{{ wt('w194') }}</h2>
        <span class="detail-page-caption"
          >{{ dashboard.current.credentials.length }} {{ wt('refinement40') }}</span
        >
      </div>
      <div v-if="!dashboard.current.credentials.length" class="wallet-empty">
        <strong>{{ wt('refinement49') }}</strong>
        <p>{{ wt('refinement50') }}</p>
      </div>
      <article
        v-for="credential in dashboard.current.credentials"
        v-else
        :key="credential.recordId || credential.txCerId"
        class="credential"
      >
        <header>
          <span>
            <small>TXCer</small>
            <b>{{ credential.amount }} CAL</b>
          </span>
          <StatusLabel
            :tone="
              isActiveCredentialFailure(credential)
                ? 'danger'
                : credential.lifecycle === 'Active'
                  ? 'success'
                  : 'neutral'
            "
          >
            {{ credential.lifecycle }}
          </StatusLabel>
        </header>
        <CredentialTrustPath :credential="credential" />
        <ExposureShareBar :shares="credential.exposureShares" />
        <p v-if="credential.error" class="credential__error">
          {{
            credential.lifecycle === 'Active' ? credential.error : wt('w196', [credential.error])
          }}
        </p>
        <details>
          <summary>{{ wt('w197') }}</summary>
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
                {{ credential.exposureShares.length }} {{ wt('w201') }}
                {{ credential.rootIds.length }} {{ wt('w202') }}
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
      </article>
    </section>
    <section class="wallet-section security-addresses" aria-labelledby="security-addresses-heading">
      <div class="wallet-section__heading">
        <h2 id="security-addresses-heading">{{ wt('w203') }}</h2>
        <span class="detail-page-caption"
          >{{ dashboard.current.addresses.length }} {{ wt('refinement2') }}</span
        >
      </div>
      <details v-for="address in dashboard.current.addresses" :key="address.address">
        <summary>{{ address.address }}</summary>
        <dl class="wallet-detail-list">
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
  </div>
</template>

<style scoped>
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

.credential {
  display: grid;
  gap: 0.75rem;
  padding-block: 1rem;
  border-top: 1px solid var(--hairline);
}

.credential:first-of-type {
  border-top: 0;
}

.credential header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.credential header > span {
  display: grid;
  gap: 0.18rem;
}

.credential header small,
.credential__error,
.credential__summary {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.credential__error {
  margin: 0;
  color: var(--warning);
}
</style>
