<script setup lang="ts">
import { smoothDetails as vSmoothDetails } from '@/directives/smoothDetails'
import { computed, reactive, ref, watch } from 'vue'
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { wCount, wt, wl, walletLocale } from '@/i18n/walletText'

import {
  PhArrowDownLeft,
  PhArrowUpRight,
  PhCaretDown as CaretDown,
  PhCheck,
} from '@phosphor-icons/vue'

import ActivityProgress from '@/components/ActivityProgress.vue'
import WalletCopyButton from '@/components/WalletCopyButton.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletPagination from '@/components/WalletPagination.vue'
import WalletTransactionConstruction from '@/components/WalletTransactionConstruction.vue'
import {
  activityAssetSymbol as assetSymbol,
  useWalletActivities,
  type ActivityRow,
} from '@/composables/useWalletActivities'
import { useWalletPagination } from '@/composables/useWalletPagination'

const activities = useWalletActivities()
const phase = ref('all')
const expanded = reactive(new Set<string>())

function trackDisclosure(event: Event, id: string) {
  if ((event.currentTarget as HTMLDetailsElement).open) expanded.add(id)
  else expanded.delete(id)
}
function matchesPhase(item: ActivityRow, value: string) {
  if (value === 'all') return true
  if (value === 'failed') return item.phase === 'failed' || !!item.crossChainError
  if (item.crossChainError || item.phase === 'failed') return false
  if (value === 'settled') return item.phase === 'settled'
  return !!item.phase && item.phase !== 'settled'
}
const phases = computed(() =>
  [
    { value: 'all', label: wt('motionAll') },
    { value: 'processing', label: wt('motionActive') },
    { value: 'settled', label: wt('motionSettled') },
    { value: 'failed', label: wt('motionFailed') },
  ].map((option) => ({
    ...option,
    count: activities.value.filter((item) => matchesPhase(item, option.value)).length,
  })),
)
const filteredActivities = computed(() =>
  activities.value.filter((item) => matchesPhase(item, phase.value)),
)
const { page, pageCount, offset: pageOffset, items: pagedActivities } =
  useWalletPagination(filteredActivities)

watch(phase, () => (page.value = 1))
watch([phase, page], () => expanded.clear())

const formatTime = (value: number) =>
  value
    ? new Intl.DateTimeFormat(walletLocale(), {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false,
      }).format(value)
    : wt('w0')

const statusTone = (item: ActivityRow) =>
  item.phase === 'failed' || item.crossChainError || /失败|恢复|rejected/i.test(item.status)
    ? 'danger'
    : item.phase === 'settled' ||
        (item.direction === 'in' && item.phase === 'spend-ready') ||
        /结算|confirm|success/i.test(item.status)
      ? 'success'
      : 'neutral'
</script>

<template>
  <div class="wallet-page wallet-refined activity-page">
    <Teleport v-if="$slots['header-action']" defer to="#intro-activity"><slot name="header-action" /></Teleport>
    <WalletPageHeader v-else :title="wt('w1')" :description="wt('w2')" />
    <section class="wallet-section activity-ledger" aria-labelledby="activity-list-heading">
      <div :class="$slots['header-action'] ? 'sr-only' : 'activity-toolbar wallet-section__heading'">
        <h2 id="activity-list-heading">{{ wt('w3') }}</h2>
        <span v-if="!$slots['header-action']" class="detail-page-caption">
          <AnimatedNumber :value="activities.length" /> {{ wCount('refinement40', activities.length) }}
        </span>
      </div>
      <Teleport
        v-if="activities.length"
        defer
        to="#overview-activity-filters"
        :disabled="!$slots['header-action']"
      >
        <SegmentedControl
          v-model="phase"
          appearance="metrics"
          compact
          semantics="buttons"
          :label="wt('motionPhase')"
          :options="phases"
        />
      </Teleport>
      <div v-if="!activities.length" class="wallet-empty">
        <strong>{{ wt('refinement45') }}</strong>
        <p>{{ wt('refinement46') }}</p>
      </div>
      <template v-else>
        <p v-if="!filteredActivities.length" class="wallet-empty">{{ wt('motionEmpty') }}</p>
        <ol v-else :key="`${phase}-${page}`" :start="pageOffset + 1">
          <li v-for="item in pagedActivities" :key="item.id">
            <details v-smooth-details @toggle="trackDisclosure($event, item.id)">
              <summary class="activity-row">
                <span class="wallet-record-icon activity-direction" aria-hidden="true">
                  <component :is="item.direction === 'out' ? PhArrowUpRight : PhArrowDownLeft" :size="19" />
                </span>
                <span class="activity-copy">
                  <b>{{ item.title }}</b>
                  <small>{{ formatTime(item.timestamp) }}</small>
                </span>
                <span class="activity-status" :data-tone="statusTone(item)">
                  <PhCheck v-if="statusTone(item) === 'success'" :size="13" aria-hidden="true" />
                  {{ item.statusLabel ?? wl(item.status) }}
                </span>
                <span class="activity-amount">
                  <b class="tabular">{{ item.direction === 'out' ? '−' : '+' }}{{ item.amount }}</b>
                  <small>{{ assetSymbol(item.coinType, item.asset) }}</small>
                </span>
                <CaretDown class="activity-caret" :size="17" aria-hidden="true" />
              </summary>
              <div class="activity-detail">
                <div class="activity-id">
                  <dl class="activity-id__value">
                    <dt>{{ wt('w10') }}</dt>
                    <dd><code>{{ item.txID }}</code></dd>
                  </dl>
                  <WalletCopyButton class="activity-id__copy" :value="item.txID" :label="wt('w10')" />
                </div>
                <WalletTransactionConstruction
                  v-if="item.progress || item.construction"
                  :active="expanded.has(item.id)"
                  :asset="assetSymbol(item.coinType, item.asset)"
                  :observed="item.construction"
                  :progress="item.progress"
                  :tx-id="item.txID"
                />
                <div v-if="item.progress" class="activity-timeline">
                  <h3>{{ wt('w303') }}</h3>
                  <ActivityProgress :progress="item.progress" />
                </div>
              </div>
            </details>
          </li>
        </ol>
        <WalletPagination v-model="page" :page-count="pageCount" :label="wt('activityPagination')" />
      </template>
    </section>
  </div>
</template>

<style scoped>
.activity-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}
ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  border-bottom: 1px solid var(--hairline);
}

li:last-child {
  border-bottom: 0;
}

.activity-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) minmax(0, max-content) minmax(4rem, 15%) auto;
  min-height: 62px;
  align-items: center;
  gap: 4px clamp(7px, 1.3cqi, 16px);
  padding: 6px 0;
  cursor: pointer;
  list-style: none;
}

.activity-row::-webkit-details-marker {
  display: none;
}

.activity-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.activity-copy b,
.activity-amount b {
  font-size: 0.9rem;
  font-weight: 600;
}

.activity-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 520;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.activity-status[data-tone='danger'] {
  color: var(--danger);
}

.activity-status > svg {
  flex: none;
}

.activity-copy small,
.activity-amount small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.activity-amount {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: flex-end;
  gap: 0 5px;
  min-width: 0;
  overflow-wrap: anywhere;
  text-align: end;
}

.activity-caret {
  color: var(--text-muted);
  transition: transform 180ms var(--ease-standard);
}

details[open] .activity-caret {
  transform: rotate(180deg);
}

@media (hover: hover) and (pointer: fine) {
  .wallet-refined .activity-row:hover {
    background: transparent;
  }

  .activity-row:hover :is(.activity-copy b, .activity-caret) {
    color: var(--wallet-selection-ink, var(--accent));
  }
}

.activity-detail {
  container: activity-detail / inline-size;
  display: grid;
  gap: 16px;
  padding: 0 0 12px;
}

.activity-detail h3 {
  margin: 0 0 8px;
  font-size: 0.86rem;
  font-weight: 620;
}

.activity-id {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 8px 10px 8px 12px;
  border-radius: var(--radius-sm);
  background: var(--selection-rail);
}

.activity-id__value {
  display: grid;
  gap: 2px 12px;
  margin: 0;
}

.activity-id__value dt {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.activity-id__value dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 0.75rem;
}

.activity-id__value code {
  font-family: var(--font-mono);
  user-select: all;
}

.activity-id__copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  padding-inline: 8px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--wallet-selection-ink, var(--accent));
  font-size: 0.75rem;
  cursor: pointer;
}

.activity-id__copy:hover {
  background: var(--surface-hover);
}

.activity-timeline {
  min-width: 0;
  padding-inline: 12px;
}

@container activity-detail (min-width: 48rem) {
  .activity-id__value {
    grid-template-columns: max-content minmax(0, 1fr);
    align-items: baseline;
  }
}

@container (max-width: 480px) {
  .activity-row {
    grid-template-columns: auto minmax(0, 1fr) minmax(3.25rem, 24%) auto;
  }
  .activity-direction,
  .activity-amount,
  .activity-caret {
    grid-row: 1 / 3;
  }
  .activity-status {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }
  .activity-amount {
    grid-column: 3;
  }
  .activity-caret {
    grid-column: 4;
  }
}
@media (prefers-reduced-motion: reduce) {
  .activity-caret {
    transition: none;
  }
}
</style>
