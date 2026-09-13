<script setup lang="ts">
import { wt, wl } from '@/i18n/walletText'

import { PhArrowDown as ArrowDown } from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'

import StatusLabel from '@/components/StatusLabel.vue'
import WalletAddressLedger from '@/components/WalletAddressLedger.vue'
import WalletBalanceField from '@/components/WalletBalanceField.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletStatusSummary from '@/components/WalletStatusSummary.vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboard = useDashboardStore()
const sweep = ref(false)
const primaryAsset = computed(() => dashboard.current.assets[0])

watch(
  () => dashboard.revision,
  (next, previous) => {
    if (next > 0 && next !== previous) {
      sweep.value = false
      requestAnimationFrame(() => (sweep.value = true))
    }
  },
)

async function refresh(): Promise<void> {
  await dashboard.sync(true)
}
</script>

<template>
  <div class="wallet-page overview">
    <WalletPageHeader
      variant="compact"
      :title="wt('w118', [dashboard.current.displayName])"
      :description="dashboard.offline ? wt('w119') : undefined"
    />

    <WalletBalanceField
      :asset="primaryAsset"
      :updated-at="dashboard.current.updatedAt"
      :offline="dashboard.offline"
      :loading="dashboard.loading"
      :animate="sweep"
      @refresh="refresh"
      @sweep-end="sweep = false"
    />

    <WalletStatusSummary :offline="dashboard.offline" :security="dashboard.current.security" />

    <WalletAddressLedger />

    <nav class="overview-shortcuts" :aria-label="wt('w120')">
      <RouterLink to="/wallet/organization"
        ><span> {{ wt('w86') }} </span><small> {{ wt('w121') }} </small></RouterLink
      >
      <RouterLink to="/wallet/blockchain"
        ><span> {{ wt('w122') }} </span><small> {{ wt('w123') }} </small></RouterLink
      >
    </nav>

    <div class="overview-ledger">
      <section class="ledger-section assets" aria-labelledby="assets-heading">
        <div class="ledger-section__heading">
          <h2 id="assets-heading">{{ wt('w124') }}</h2>
          <StatusLabel :tone="dashboard.offline ? 'warning' : 'success'">
            {{ dashboard.offline ? wt('w125') : wt('w126') }}
          </StatusLabel>
        </div>
        <div class="asset-head">
          <span> {{ wt('w124') }} </span><span> {{ wt('w127') }} </span
          ><span> {{ wt('w128') }} </span>
        </div>
        <div v-for="asset in dashboard.current.assets" :key="asset.symbol" class="asset-row">
          <span class="asset-identity">
            <i>{{ asset.symbol.slice(0, 1) }}</i>
            <span>
              <b>{{ asset.symbol }}</b>
              <small>{{ asset.name }}</small>
            </span>
          </span>
          <span class="asset-composition">
            <small>UTXO {{ asset.utxoAvailable }}</small>
            <small>TXCer {{ asset.txCerSpendable }}</small>
          </span>
          <b class="tabular">{{ asset.total }}</b>
        </div>
      </section>

      <section class="ledger-section activity" aria-labelledby="activity-heading">
        <div class="ledger-section__heading">
          <h2 id="activity-heading">{{ wt('w129') }}</h2>
          <RouterLink to="/wallet/activity"> {{ wt('w130') }} </RouterLink>
        </div>
        <ul v-if="dashboard.current.activities.length">
          <li v-for="item in dashboard.current.activities.slice(0, 5)" :key="item.id">
            <ArrowDown :size="17" aria-hidden="true" />
            <span>
              <b>{{ item.title }}</b>
              <small>{{ wl(item.status) }}</small>
            </span>
            <b class="tabular">{{ item.amount }}</b>
          </li>
        </ul>
        <div v-else class="wallet-empty">{{ wt('w131') }}</div>
      </section>
    </div>

    <p v-if="dashboard.error" class="wallet-notice wallet-notice--warning">
      {{ wt('w132') }} {{ wl(dashboard.error) }} {{ wt('w133') }}
    </p>
  </div>
</template>

<style scoped>
.overview-ledger {
  display: grid;
  grid-template-columns: minmax(0, 7fr) minmax(300px, 5fr);
  border-bottom: 1px solid var(--hairline);
}

.overview-shortcuts {
  display: none;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.65rem;
}
.overview-shortcuts a {
  display: grid;
  min-height: 70px;
  align-content: center;
  gap: 0.18rem;
  padding: 0.8rem;
  border: 1px solid var(--hairline);
  border-radius: var(--radius-md);
  color: var(--text);
}
.overview-shortcuts small {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.ledger-section {
  min-width: 0;
  padding: 0.55rem 0 0;
}

.ledger-section + .ledger-section {
  margin-left: clamp(1.5rem, 3vw, 2.5rem);
  padding-left: clamp(1.5rem, 3vw, 2.5rem);
  border-left: 1px solid var(--hairline);
}

.ledger-section__heading {
  display: flex;
  min-height: 48px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.ledger-section__heading h2 {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 600;
  letter-spacing: -0.025em;
}

.ledger-section__heading a {
  color: var(--accent);
  font-size: 0.76rem;
}

.asset-head,
.asset-row {
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 1fr 0.7fr;
  gap: 1rem;
}

.asset-head {
  min-height: 34px;
  color: var(--text-faint);
  font-size: 0.68rem;
}

.asset-row {
  min-height: 76px;
  border-top: 1px solid var(--hairline);
}

.asset-row > b {
  text-align: right;
}

.asset-identity {
  display: flex;
  align-items: center;
  gap: 0.7rem;
}

.asset-identity > span,
.asset-composition {
  display: grid;
  gap: 0.18rem;
}

.asset-identity i {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-style: normal;
  font-weight: 720;
  place-items: center;
}

.asset-row small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.activity ul {
  margin: 0;
  padding: 0;
  list-style: none;
}

.activity li {
  display: grid;
  min-height: 64px;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: 0.7rem;
  border-top: 1px solid var(--hairline);
}

.activity li > span {
  display: grid;
  gap: 0.12rem;
}

.activity li small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

@media (max-width: 940px) {
  .overview-shortcuts {
    display: grid;
  }
  .overview-ledger {
    grid-template-columns: 1fr;
  }

  .ledger-section + .ledger-section {
    margin: 1.2rem 0 0;
    padding: 1.2rem 0 0;
    border-top: 1px solid var(--hairline);
    border-left: 0;
  }
}

@media (max-width: 440px) {
  .asset-head {
    display: none;
  }

  .asset-row {
    grid-template-columns: 1fr auto;
    padding-block: 0.75rem;
  }

  .asset-composition {
    grid-column: 1 / -1;
    grid-row: 2;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
