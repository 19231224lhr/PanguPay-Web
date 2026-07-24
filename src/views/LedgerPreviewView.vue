<script setup lang="ts">
import {
  PhArrowDown as ArrowDown,
  PhArrowUp as ArrowUp,
  PhClockCounterClockwise as ClockCounterClockwise,
  PhGear as Gear,
  PhHouse as House,
  PhPaperPlaneTilt as PaperPlaneTilt,
  PhShieldCheck as ShieldCheck,
  PhWallet as Wallet,
} from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import AppButton from '@/components/AppButton.vue'
import AppShell from '@/components/AppShell.vue'
import ProgressTimeline from '@/components/ProgressTimeline.vue'
import StatusLabel from '@/components/StatusLabel.vue'

const { t } = useI18n()

const navItems = computed(() => [
  { label: t('ledger.overview'), icon: House, to: '/__ledger-preview' },
  { label: t('ledger.send'), icon: PaperPlaneTilt, to: '/__ledger-preview?panel=send' },
  {
    label: t('ledger.activity'),
    icon: ClockCounterClockwise,
    to: '/__ledger-preview?panel=activity',
  },
  { label: t('ledger.security'), icon: ShieldCheck, to: '/__ledger-preview?panel=security' },
  { label: t('ledger.settings'), icon: Gear, to: '/__foundation' },
])

const assuranceSteps = computed(() => [
  { label: t('ledger.fastReady'), detail: 'TXCer Active', state: 'complete' as const },
  { label: t('ledger.evidence'), detail: 'Issuer + AssignAck', state: 'complete' as const },
  { label: t('ledger.audit'), detail: 'CFAA async', state: 'active' as const },
  { label: t('ledger.local'), detail: '3-of-4 BlockQC', state: 'pending' as const },
])

const assets = [
  { symbol: 'PGC', name: 'Pangu Coin', balance: '1,080.50000000', tone: 'blue' },
  { symbol: 'BTC', name: 'Bitcoin', balance: '0.00420000', tone: 'orange' },
  { symbol: 'ETH', name: 'Ethereum', balance: '0.36000000', tone: 'violet' },
]

const activities = computed(() => [
  { title: 'Bob', detail: '12.00000000 PGC', status: t('ledger.spendReady'), type: 'out' },
  { title: 'Carol', detail: '28.50000000 PGC', status: t('ledger.certified'), type: 'in' },
  {
    title: 'TXCer #8f596e7f',
    detail: '5.00000000 PGC',
    status: t('ledger.pendingAudit'),
    type: 'in',
  },
])
</script>

<template>
  <AppShell :items="navItems" :navigation-label="t('ledger.navLabel')">
    <div class="ledger-page">
      <header class="ledger-page__heading">
        <div>
          <StatusLabel tone="accent">{{ t('common.demo') }}</StatusLabel>
          <h1>{{ t('ledger.greeting') }}</h1>
          <p>{{ t('ledger.subtitle') }}</p>
        </div>
      </header>

      <section class="balance-panel" aria-labelledby="balance-title">
        <div class="balance-panel__amount">
          <p id="balance-title">{{ t('ledger.portfolio') }}</p>
          <strong class="tabular">1,284.50 <small>PGC</small></strong>
          <span><i aria-hidden="true" />{{ t('ledger.available') }}</span>
        </div>
        <div class="balance-panel__actions">
          <AppButton size="large">
            <PaperPlaneTilt :size="18" weight="bold" />
            {{ t('ledger.quickSend') }}
          </AppButton>
          <AppButton size="large" variant="secondary">
            <ArrowDown :size="18" weight="bold" />
            {{ t('ledger.receive') }}
          </AppButton>
        </div>
        <div class="balance-panel__mark" aria-hidden="true">
          <Wallet :size="132" weight="thin" />
        </div>
      </section>

      <div class="ledger-grid">
        <section class="ledger-section ledger-section--assets" aria-labelledby="assets-title">
          <div class="ledger-section__heading">
            <h2 id="assets-title" class="section-heading">{{ t('ledger.assets') }}</h2>
          </div>
          <div class="asset-table" role="table" :aria-label="t('ledger.assets')">
            <div class="asset-table__head" role="row">
              <span role="columnheader">{{ t('ledger.asset') }}</span>
              <span role="columnheader">{{ t('ledger.balance') }}</span>
              <span role="columnheader">{{ t('ledger.network') }}</span>
            </div>
            <div v-for="asset in assets" :key="asset.symbol" class="asset-row" role="row">
              <span class="asset-row__identity" role="cell">
                <i :class="`asset-row__icon asset-row__icon--${asset.tone}`">{{
                  asset.symbol[0]
                }}</i>
                <span
                  ><strong>{{ asset.symbol }}</strong
                  ><small>{{ asset.name }}</small></span
                >
              </span>
              <strong class="tabular" role="cell">{{ asset.balance }}</strong>
              <span role="cell">Transfer Area</span>
            </div>
          </div>
        </section>

        <section class="ledger-section ledger-section--assurance" aria-labelledby="assurance-title">
          <div class="ledger-section__heading">
            <h2 id="assurance-title" class="section-heading">{{ t('ledger.txcer') }}</h2>
            <StatusLabel tone="success">Active</StatusLabel>
          </div>
          <ProgressTimeline :items="assuranceSteps" />
        </section>

        <section class="ledger-section ledger-section--activity" aria-labelledby="activity-title">
          <div class="ledger-section__heading">
            <h2 id="activity-title" class="section-heading">{{ t('ledger.recent') }}</h2>
            <button type="button">{{ t('ledger.allActivity') }}</button>
          </div>
          <ul class="activity-list">
            <li v-for="activity in activities" :key="activity.title + activity.detail">
              <span class="activity-list__icon" :class="`activity-list__icon--${activity.type}`">
                <ArrowUp v-if="activity.type === 'out'" :size="17" weight="bold" />
                <ArrowDown v-else :size="17" weight="bold" />
              </span>
              <span class="activity-list__identity"
                ><strong>{{ activity.title }}</strong
                ><small>{{ activity.status }}</small></span
              >
              <strong class="tabular">{{ activity.detail }}</strong>
            </li>
          </ul>
        </section>
      </div>
    </div>
  </AppShell>
</template>

<style scoped>
.ledger-page {
  display: grid;
  gap: 1.45rem;
  animation: page-enter var(--duration-enter) var(--ease-standard) both;
}

.ledger-page__heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
}

.ledger-page__heading h1 {
  margin: 0.9rem 0 0.35rem;
  font-size: clamp(2rem, 4vw, 3.4rem);
  font-weight: 680;
  letter-spacing: -0.06em;
  line-height: 1;
}

.ledger-page__heading p {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.balance-panel {
  position: relative;
  display: grid;
  min-height: 230px;
  align-items: end;
  overflow: hidden;
  grid-template-columns: 1fr auto;
  gap: 2rem;
  padding: clamp(1.4rem, 3.4vw, 2.4rem);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  background: var(--surface);
  box-shadow: var(--shadow-soft);
}

.balance-panel::before {
  position: absolute;
  top: -140px;
  right: -80px;
  width: 360px;
  height: 360px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--hero-halo), transparent 68%);
  content: '';
}

.balance-panel__amount {
  z-index: 1;
  display: grid;
  align-content: end;
  gap: 0.62rem;
}

.balance-panel__amount p,
.balance-panel__amount span {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.78rem;
}

.balance-panel__amount > strong {
  font-size: clamp(2.6rem, 6vw, 4.8rem);
  font-weight: 610;
  letter-spacing: -0.07em;
  line-height: 0.95;
}

.balance-panel__amount small {
  color: var(--text-muted);
  font-size: 0.25em;
  font-weight: 650;
  letter-spacing: 0.04em;
}

.balance-panel__amount span {
  display: flex;
  align-items: center;
  gap: 0.42rem;
}

.balance-panel__amount i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--success);
}

.balance-panel__actions {
  z-index: 1;
  display: flex;
  gap: 0.6rem;
}

.balance-panel__mark {
  position: absolute;
  top: 1.2rem;
  right: 2rem;
  color: var(--border-strong);
  transform: rotate(-8deg);
}

.ledger-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 0.7fr);
  gap: 1rem;
}

.ledger-section {
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.ledger-section--activity {
  grid-column: 1 / -1;
}

.ledger-section__heading {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.9rem;
}

.ledger-section__heading button {
  min-height: 44px;
  padding: 0 0.4rem;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 650;
}

.asset-table {
  display: grid;
}

.asset-table__head,
.asset-row {
  display: grid;
  align-items: center;
  grid-template-columns: 1.25fr 1fr 0.8fr;
  gap: 1rem;
}

.asset-table__head {
  min-height: 34px;
  color: var(--text-faint);
  font-size: 0.68rem;
  font-weight: 650;
  text-transform: uppercase;
}

.asset-row {
  min-height: 66px;
  border-top: 1px solid var(--border);
}

.asset-row > strong,
.asset-row > span:last-child {
  font-size: 0.78rem;
}

.asset-row > span:last-child {
  color: var(--text-muted);
}

.asset-row__identity {
  display: flex;
  align-items: center;
  gap: 0.68rem;
}

.asset-row__identity > span {
  display: grid;
  gap: 0.15rem;
}

.asset-row__identity strong {
  font-size: 0.82rem;
}

.asset-row__identity small {
  color: var(--text-muted);
  font-size: 0.68rem;
}

.asset-row__icon,
.activity-list__icon {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  border-radius: 11px;
  font-size: 0.76rem;
  font-style: normal;
  font-weight: 750;
  place-items: center;
}

.asset-row__icon--blue {
  background: color-mix(in srgb, var(--accent) 13%, transparent);
  color: var(--accent);
}

.asset-row__icon--orange {
  background: color-mix(in srgb, var(--warning) 13%, transparent);
  color: var(--warning);
}

.asset-row__icon--violet {
  background: color-mix(in srgb, #7b6cf6 13%, transparent);
  color: #7b6cf6;
}

.activity-list {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.activity-list li {
  display: grid;
  min-height: 64px;
  align-items: center;
  grid-template-columns: auto 1fr auto;
  gap: 0.75rem;
  border-top: 1px solid var(--border);
}

.activity-list__icon {
  background: var(--surface-subtle);
  color: var(--text-muted);
}

.activity-list__icon--in {
  color: var(--success);
}

.activity-list__identity {
  display: grid;
  gap: 0.15rem;
}

.activity-list__identity strong,
.activity-list > li > strong {
  font-size: 0.8rem;
}

.activity-list__identity small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

@media (max-width: 1023px) {
  .ledger-grid {
    grid-template-columns: 1fr;
  }

  .ledger-section--activity {
    grid-column: auto;
  }
}

@media (max-width: 599px) {
  .ledger-page {
    gap: 1rem;
  }

  .ledger-page__heading h1 {
    font-size: 2.25rem;
  }

  .balance-panel {
    min-height: 280px;
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .balance-panel__actions {
    align-items: end;
  }

  .balance-panel__actions :deep(.app-button) {
    flex: 1;
  }

  .balance-panel__mark {
    top: 1rem;
    right: 1rem;
  }

  .ledger-section {
    padding: 1rem;
  }

  .asset-table__head {
    display: none;
  }

  .asset-row {
    grid-template-columns: 1fr auto;
  }

  .asset-row > span:last-child {
    display: none;
  }

  .activity-list > li > strong {
    font-size: 0.72rem;
  }
}
</style>
