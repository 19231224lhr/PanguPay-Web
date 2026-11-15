<script setup lang="ts">
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import { wt, wl, walletLocale } from '@/i18n/walletText'
import { PhArrowDown as ArrowDown, PhArrowUpRight as ArrowUpRight } from '@phosphor-icons/vue'
import { computed, nextTick, ref } from 'vue'
import '@/styles/wallet-overview.css'

import { useWalletStore } from '@/stores/wallet'
import { assetIdentityForType } from '@/wallet/dashboard'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletAddressLedger from '@/components/WalletAddressLedger.vue'
import WalletBalanceField from '@/components/WalletBalanceField.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletNetworkOverview from '@/components/WalletNetworkOverview.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletActivities } from '@/composables/useWalletActivities'

const dashboard = useDashboardStore()
const wallet = useWalletStore()
const activities = useWalletActivities()
const receiveAddresses = computed(() =>
  wallet.activeAddresses
    .filter((item) => wallet.metadata?.addresses[item.address]?.registration === 'active')
    .map((item) => ({ ...item, asset: assetIdentityForType(item.type) })),
)
const addressLedger = ref<HTMLElement>()
async function revealAddress(address: string): Promise<void> {
  const ledger = addressLedger.value
  if (!ledger) return
  await nextTick()
  const row = [...ledger.querySelectorAll<HTMLElement>('[data-address]')].find(
    (item) => item.dataset.address === address,
  )
  const target = row ?? ledger.querySelector<HTMLElement>('h2')
  target?.focus({ preventScroll: true })
  target?.scrollIntoView({
    block: 'center',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  })
}
const snapshotReady = computed(() => dashboard.current.source !== 'empty')
const securityLabel = computed(() =>
  !snapshotReady.value
    ? wt('w19')
    : dashboard.offline
      ? wt('w380')
      : dashboard.current.security.isolatedCount
        ? wt('refinement32')
        : dashboard.current.credentials.length
          ? wt('w126')
          : wt('refinement33'),
)
const primaryAsset = computed(() => dashboard.current.assets[0])

async function refresh(): Promise<void> {
  await dashboard.sync(true)
}
</script>
<template>
  <div class="wallet-page overview">
    <WalletPageHeader variant="compact" :title="wt('refinement34')">
      <span class="overview-account"
        >{{ dashboard.current.displayName }} ·
        {{ dashboard.current.organization ? wt('refinement35') : wt('refinement20') }}</span
      >
    </WalletPageHeader>

    <div class="overview-top overview-pair">
      <WalletBalanceField
        :asset="primaryAsset"
        :assets="dashboard.current.assets"
        :updated-at="dashboard.current.updatedAt"
        :offline="dashboard.offline"
        :loading="dashboard.loading"
        @refresh="refresh"
      />
      <section class="overview-panel security-preview" aria-labelledby="overview-security">
        <div class="overview-panel__heading">
          <h2 id="overview-security">
            <RouterLink to="/wallet/security">{{ wt('w177') }}</RouterLink>
          </h2>
          <StatusLabel
            :tone="
              !snapshotReady || dashboard.offline
                ? 'warning'
                : dashboard.current.security.isolatedCount
                  ? 'danger'
                  : 'neutral'
            "
            >{{ securityLabel }}</StatusLabel
          >
        </div>
        <div class="overview-panel__body">
          <dl class="overview-metrics">
            <div>
              <dt>{{ wt('refinement36') }}</dt>
              <dd class="tabular">
                <AnimatedNumber
                  :value="snapshotReady ? dashboard.current.credentials.length : null"
                />
              </dd>
            </div>
            <div>
              <dt>{{ wt('refinement37') }}</dt>
              <dd class="tabular">
                <AnimatedNumber
                  :value="snapshotReady ? dashboard.current.security.pendingAudits : null"
                />
              </dd>
            </div>
            <div :class="{ 'needs-attention': dashboard.current.security.isolatedCount }">
              <dt>{{ wt('w188') }}</dt>
              <dd class="tabular">
                <AnimatedNumber
                  :value="snapshotReady ? dashboard.current.security.isolatedCount : null"
                />
              </dd>
            </div>
          </dl>
          <WalletFigure kind="stack" :intensity="0.3" />
        </div>
        <RouterLink class="text-action security-detail" to="/wallet/security">
          {{ wt('refinement38') }} <ArrowUpRight :size="15" aria-hidden="true" />
        </RouterLink>
      </section>
    </div>
    <p v-if="dashboard.offline" class="wallet-notice wallet-notice--warning">
      {{ wt('refinement39') }}
    </p>
    <p v-if="dashboard.error" class="wallet-notice wallet-notice--warning">
      {{ wt('w132') }}{{ dashboard.error }}
    </p>

    <div class="overview-main overview-pair">
      <section class="overview-panel activity" aria-labelledby="activity-heading">
        <div class="overview-panel__heading">
          <h2 id="activity-heading">{{ wt('w129') }}</h2>
          <span class="overview-caption">{{ activities.length }} {{ wt('refinement40') }}</span>
        </div>
        <div class="overview-panel__body activity-body">
          <div>
            <ul v-if="activities.length">
              <li v-for="item in activities.slice(0, 3)" :key="item.id">
                <component
                  :is="item.direction === 'out' ? ArrowUpRight : ArrowDown"
                  :size="17"
                  aria-hidden="true"
                />
                <span>
                  <b>{{ item.title }}</b>
                  <small
                    >{{ wl(item.status) }} ·
                    {{ new Date(item.timestamp).toLocaleString(walletLocale()) }}</small
                  >
                </span>
                <b class="tabular">{{ item.amount }}</b>
              </li>
            </ul>
            <div v-else class="overview-empty">
              <div>
                <strong>{{ wt('refinement41') }}</strong>
                <p>{{ wt('refinement42') }}</p>
              </div>
            </div>
          </div>
          <WalletFigure kind="drawer" :intensity="0.35" />
        </div>
        <RouterLink class="text-action activity-detail" to="/wallet/activity">
          {{ wt('refinement43') }} <ArrowUpRight :size="15" aria-hidden="true" />
        </RouterLink>
      </section>
      <section class="overview-panel receive-preview" aria-labelledby="receive-heading">
        <header class="overview-panel__heading">
          <h2 id="receive-heading">{{ wt('w144') }}</h2>
          <span class="overview-caption"
            >{{ wallet.activeAddresses.length }} {{ wt('refinement2') }}</span
          >
        </header>
        <div class="overview-panel__body">
          <div class="receive-copy">
            <ul v-if="receiveAddresses.length" class="receive-addresses">
              <li v-for="item in receiveAddresses" :key="item.address">
                <p class="receive-network">{{ item.asset.symbol }} · {{ item.asset.network }}</p>
                <a
                  class="receive-address"
                  href="#complete-address-ledger"
                  :aria-label="wt('refinement60', [item.asset.symbol, item.address])"
                  @click.prevent="revealAddress(item.address)"
                  ><code>{{ item.address }}</code></a
                >
              </li>
            </ul>
            <p v-else class="overview-caption">{{ wt('refinement44') }}</p>
          </div>
          <WalletFigure kind="phone" :intensity="0.25" />
        </div>
      </section>
    </div>

    <WalletNetworkOverview
      :organization="dashboard.current.organization"
      :offline="dashboard.offline"
    />

    <section
      id="complete-address-ledger"
      ref="addressLedger"
      class="address-details"
      :aria-label="wt('refinement1')"
    >
      <WalletAddressLedger />
    </section>
  </div>
</template>

<style scoped>
.overview {
  --wallet-page-gap: 1rem;
  container-type: inline-size;
}
.overview :deep(.wallet-page-header--compact) {
  min-height: 36px;
  align-items: center;
}
.overview :deep(.wallet-page-header--compact h1) {
  font-size: 1.45rem;
}
.overview-account {
  color: var(--text-muted);
  font-size: 0.8rem;
}
.text-action {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 44px;
  padding: 0;
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.75rem;
  background: transparent;
  cursor: pointer;
}
.text-action:hover {
  color: var(--text);
}
.security-detail {
  align-self: flex-start;
  margin-top: auto;
}
.needs-attention {
  color: var(--danger);
}
.activity-detail {
  align-self: flex-start;
  margin-top: auto;
}
.activity ul {
  padding: 0;
  margin: 0;
  list-style: none;
}
.activity li {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 0.4rem;
  align-items: center;
  min-height: 54px;
  border-bottom: 1px solid var(--hairline);
}
.activity li > span {
  display: grid;
  gap: 0.2rem;
}
.activity li b {
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.activity li small {
  color: var(--text-muted);
  font-size: 0.65rem;
  line-height: 1.5;
}
.overview-empty strong {
  font-size: 0.85rem;
  font-weight: 500;
}
.overview-empty p {
  margin: 0.5rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.7;
}
.receive-copy {
  min-width: 0;
}
.receive-network {
  margin: 0 0 0.5rem;
  color: var(--text);
  font-size: 0.8rem;
}
.receive-copy code {
  display: block;
  font: 0.72rem/1.6 var(--font-mono);
  overflow-wrap: anywhere;
  color: var(--text-muted);
}
.receive-addresses {
  display: grid;
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.receive-address {
  display: block;
  border-radius: 4px;
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}
.receive-address:hover code {
  color: var(--accent);
}
.receive-address:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 4px;
}
.security-preview h2 a {
  color: inherit;
}
.security-preview h2 a:hover {
  color: var(--accent);
}
.receive-preview .overview-panel__body {
  margin-bottom: 0.5rem;
}
.address-details {
  border: 1px solid var(--hairline);
  border-radius: 16px;
  background: var(--overview-panel-surface);
}
@container (max-width: 540px) {
  .overview :deep(.wallet-page-header--compact) {
    align-items: flex-start;
    gap: 0.5rem;
  }
  .overview-account {
    font-size: 0.75rem;
  }
}
</style>
