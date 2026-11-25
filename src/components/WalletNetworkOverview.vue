<script setup lang="ts">
import { organizationLabel, wt, walletLocale } from '@/i18n/walletText'
import { computed } from 'vue'
import { PhArrowClockwise, PhCaretDown } from '@phosphor-icons/vue'
import { useWalletNetwork } from '@/composables/useWalletNetwork'
import type { OrganizationSummary } from '@/wallet/types'
import OverviewDetail from './OverviewDetail.vue'
import type { OverviewPanel } from '@/wallet/overviewPanels'
import type { OverviewCardEdge } from '@/wallet/overviewLayout'
import StatusLabel from './StatusLabel.vue'
import WalletFigure from './WalletFigure.vue'
import WalletPageHeader from './WalletPageHeader.vue'

defineProps<{
  active?: OverviewPanel
  card?: 'organization' | 'blockchain'
  hidden?: boolean
  editing?: boolean
  edge?: OverviewCardEdge
  organization?: OrganizationSummary
  offline: boolean
}>()
const { chainStatus, chainLoading: loading, chainError, chainCheckedAt, refreshChain, directory } =
  useWalletNetwork()
const status = computed(() => (chainError.value ? undefined : chainStatus.value))
const error = computed(() => (chainError.value ? wt('refinement16') : ''))
const checkedAt = computed(() =>
  chainCheckedAt.value ? new Date(chainCheckedAt.value).toLocaleTimeString(walletLocale()) : '',
)
const organizationError = computed(() => (directory.error.value ? wt('refinement17') : ''))
const organizationCount = computed(() => directory.data.value?.length)
const chainLabel = computed(() => {
  if (error.value) return wt('w315')
  if (!status.value) return wt('w19')
  if (!status.value.enabled) return wt('refinement13')
  return status.value.safetyStatus === 'NORMAL'
    ? wt('w181')
    : status.value.safetyStatus || wt('refinement14')
})

</script>

<template>
  <section
    v-if="!card || card === 'organization'"
    v-show="!hidden"
    data-card="organization"
    :data-overview-edge="edge"
    class="overview-disclosure"
    :class="{ 'is-expanded': active === 'organization' }"
    aria-labelledby="overview-organization"
  >
    <slot name="edit-controls" />
    <div class="overview-summary overview-panel" :inert="editing">
      <WalletPageHeader
        v-if="active === 'organization'"
        heading-id="overview-organization"
        :title="wt('w86')"
        :description="wt('overviewOrganizationIntro')"
      >
        <div id="intro-organization" class="overview-header-action"></div>
      </WalletPageHeader>
      <header v-else class="overview-panel__heading">
        <h2 id="overview-organization">
          <RouterLink
            to="/wallet#organization"
            aria-expanded="false"
            aria-controls="detail-organization"
            >{{ wt('w86') }}</RouterLink
          >
        </h2>
        <StatusLabel :tone="offline ? 'warning' : 'neutral'">{{
          offline ? wt('refinement18') : organization ? wt('refinement19') : wt('refinement20')
        }}</StatusLabel>
      </header>
      <div class="overview-panel__body">
        <dl v-if="active === 'organization'" class="overview-summary-metrics">
          <div class="overview-summary-metrics__primary">
            <dt>{{ wt('refinement21') }}</dt>
            <dd class="overview-summary-metrics__text">
              {{ organizationLabel(organization) || (offline ? wt('refinement22') : wt('refinement23')) }}
            </dd>
          </div>
          <div v-if="organization">
            <dt>{{ wt('refinement24') }}</dt>
            <dd>{{ organization.role === 'member' ? wt('refinement35') : organization.role }}</dd>
          </div>
          <div v-if="organizationCount !== undefined">
            <dt>{{ wt('refinement25') }}</dt>
            <dd class="tabular">{{ organizationCount }}</dd>
          </div>
        </dl>
        <dl v-else class="overview-rows">
          <div>
            <dt>{{ wt('refinement21') }}</dt>
            <dd>
              {{ organizationLabel(organization) || (offline ? wt('refinement22') : wt('refinement23')) }}
            </dd>
          </div>
          <div v-if="organization">
            <dt>{{ wt('refinement24') }}</dt>
            <dd>{{ organization.role === 'member' ? wt('refinement35') : organization.role }}</dd>
          </div>
          <div>
            <dt>{{ wt('refinement25') }}</dt>
            <dd>
              {{
                organizationCount !== undefined
                  ? wt('refinement59', [organizationCount])
                  : organizationError
                    ? '—'
                    : wt('w19')
              }}
            </dd>
          </div>
        </dl>
        <WalletFigure kind="settle" :intensity="0.3" />
      </div>
      <div v-if="active === 'organization' && (organization || offline)" class="overview-summary__footer overview-summary__meta">
        <span v-if="offline">{{ wt('refinement18') }}</span>
        <span v-else>{{ wt('w89') }}</span>
        <span v-if="organization?.name && organization.name !== organization.id">
          {{ wt('w47') }} <code>{{ organization.id }}</code>
        </span>
      </div>
      <p v-if="organizationError && active !== 'organization'" class="network-error" role="status">
        {{ organizationCount !== undefined ? wt('networkCachedData') : organizationError }}
        <button :disabled="directory.loading.value" @click="directory.refresh()">
          {{ wt('refinement26') }}
        </button>
      </p>
      <RouterLink
        v-if="active !== 'organization'"
        class="network-detail"
        to="/wallet#organization"
        aria-expanded="false"
        aria-controls="detail-organization"
      >
        {{ wt('refinement27') }}
        <PhCaretDown :size="14" aria-hidden="true" />
      </RouterLink>
    </div>
    <OverviewDetail v-if="active === 'organization'" panel="organization" />
  </section>

  <section
    v-if="!card || card === 'blockchain'"
    v-show="!hidden"
    data-card="blockchain"
    :data-overview-edge="edge"
    class="overview-disclosure"
    :class="{ 'is-expanded': active === 'blockchain' }"
    aria-labelledby="overview-chain"
  >
    <slot name="edit-controls" />
    <div class="overview-summary overview-panel" :inert="editing">
      <WalletPageHeader
        v-if="active === 'blockchain'"
        heading-id="overview-chain"
        :title="wt('refinement28')"
        :description="wt('overviewChainIntro')"
      >
        <div id="intro-blockchain" class="overview-header-action"></div>
      </WalletPageHeader>
      <header v-else class="overview-panel__heading">
        <h2 id="overview-chain">
          <RouterLink
            to="/wallet#blockchain"
            aria-expanded="false"
            aria-controls="detail-blockchain"
            >{{ wt('refinement28') }}</RouterLink
          >
        </h2>
        <div class="chain-actions">
          <StatusLabel :tone="chainLabel === wt('w181') ? 'success' : 'warning'">{{
            chainLabel
          }}</StatusLabel
          ><button
            :aria-label="wt('refinement29')"
            :disabled="loading"
            :aria-busy="loading"
            @click="refreshChain()"
          >
            <PhArrowClockwise :size="17" />
          </button>
        </div>
      </header>
      <div class="overview-panel__body">
        <div v-if="active === 'blockchain'" id="overview-chain-status"></div>
        <dl v-else class="overview-metrics">
          <div>
            <dt>{{ wt('w16') }}</dt>
            <dd class="tabular">{{ status?.certifiedHeight ?? '—' }}</dd>
          </div>
          <div>
            <dt>{{ wt('w17') }}</dt>
            <dd class="tabular">
              {{ status ? `${status.quorum} / ${status.validatorCount}` : '—' }}
            </dd>
          </div>
          <div>
            <dt>{{ wt('w18') }}</dt>
            <dd class="tabular">{{ status?.currentView ?? '—' }}</dd>
          </div>
        </dl>
        <WalletFigure kind="branches" :intensity="0.3" />
      </div>
      <div v-if="active === 'blockchain'" id="overview-chain-footer" class="overview-summary__footer"></div>
      <p v-if="error && active !== 'blockchain'" class="network-error" role="status">{{ error }}</p>
      <div v-if="active !== 'blockchain'" class="network-footer">
        <RouterLink
          class="network-detail"
          to="/wallet#blockchain"
          aria-expanded="false"
          aria-controls="detail-blockchain"
        >
          {{ wt('refinement30') }}
          <PhCaretDown :size="14" aria-hidden="true" />
        </RouterLink>
        <span v-if="checkedAt">{{ checkedAt }} {{ wt('refinement31') }}</span>
      </div>
    </div>
    <OverviewDetail v-if="active === 'blockchain'" panel="blockchain" />
  </section>
</template>

<style scoped>
.chain-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}
.chain-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  min-height: 36px;
  border-radius: 8px;
  color: var(--text-muted);
  background: transparent;
  cursor: pointer;
}
button:disabled {
  opacity: 0.5;
  cursor: wait;
}
button:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--text);
}
h2 a {
  color: inherit;
}
h2 a:hover,
.network-detail:hover {
  color: var(--accent);
}
.network-detail {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  min-height: 44px;
  margin-top: auto;
  color: var(--text-muted);
  font-size: 0.75rem;
  align-self: flex-start;
}
.network-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0 0.5rem;
  margin-top: auto;
}
.network-footer span {
  color: var(--text-muted);
  font-size: 0.65rem;
}
p {
  font-size: 0.75rem;
  line-height: 1.6;
  overflow-wrap: anywhere;
}
.network-error {
  color: var(--warning);
}
@media (pointer: coarse) {
  .chain-actions button {
    min-width: 44px;
    min-height: 44px;
  }
}
</style>
