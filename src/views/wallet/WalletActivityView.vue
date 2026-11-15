<script setup lang="ts">
import { smoothDetails as vSmoothDetails } from '@/directives/smoothDetails'
import { computed, ref } from 'vue'
import AnimatedNumber from '@/components/AnimatedNumber.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import { wt, wl, walletLocale } from '@/i18n/walletText'

import { PhCaretDown as CaretDown } from '@phosphor-icons/vue'

import ActivityProgress from '@/components/ActivityProgress.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import WalletFigure from '@/components/WalletFigure.vue'
import {
  activityAssetSymbol as assetSymbol,
  useWalletActivities,
  type ActivityRow,
} from '@/composables/useWalletActivities'
import { transferModeLabel } from '@/transfer'

const activities = useWalletActivities()
const phase = ref('all')
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
    : item.phase === 'settled' || /结算|confirm|success/i.test(item.status)
      ? 'success'
      : 'neutral'
</script>

<template>
  <div class="wallet-page wallet-refined activity-page">
    <WalletPageHeader :title="wt('w1')" :description="wt('w2')" />
    <section class="wallet-section activity-ledger" aria-labelledby="activity-list-heading">
      <div class="detail-page-intro">
        <div class="detail-page-intro__copy">
          <h2 id="activity-list-heading">{{ wt('w3') }}</h2>
          <span class="detail-page-caption"
            ><AnimatedNumber :value="activities.length" /> {{ wt('refinement40') }}</span
          >
        </div>
        <WalletFigure kind="drawer" />
      </div>
      <div v-if="!activities.length" class="wallet-empty">
        <strong>{{ wt('refinement45') }}</strong>
        <p>{{ wt('refinement46') }}</p>
      </div>
      <template v-else>
        <SegmentedControl
          v-model="phase"
          class="activity-phases"
          compact
          semantics="buttons"
          :label="wt('motionPhase')"
          :options="phases"
        />
        <p v-if="!filteredActivities.length" class="wallet-empty">{{ wt('motionEmpty') }}</p>
        <ol>
          <li v-for="item in filteredActivities" :key="item.id">
            <details v-smooth-details>
              <summary>
                <span class="activity-copy">
                  <b>{{ item.title }}</b>
                  <small>{{ formatTime(item.timestamp) }}</small>
                </span>
                <StatusLabel class="activity-status" :tone="statusTone(item)">
                  {{ wl(item.status) }}
                </StatusLabel>
                <span class="activity-amount">
                  <b class="tabular">{{ item.direction === 'out' ? '−' : '+' }}{{ item.amount }}</b>
                  <small>{{ assetSymbol(item.coinType, item.asset) }}</small>
                </span>
                <CaretDown class="activity-caret" :size="17" aria-hidden="true" />
              </summary>
              <div class="activity-detail">
                <ActivityProgress :progress="item.progress" :status="item.status" />
                <dl>
                  <div>
                    <dt>{{ wt('w6') }}</dt>
                    <dd>{{ item.direction === 'out' ? wt('w7') : wt('w8') }}</dd>
                  </div>
                  <div v-if="item.mode">
                    <dt>{{ wt('w9') }}</dt>
                    <dd>
                      {{ transferModeLabel(item.mode) }}
                    </dd>
                  </div>
                  <div>
                    <dt>{{ wt('w10') }}</dt>
                    <dd class="mono">{{ item.txID }}</dd>
                  </div>
                </dl>
              </div>
            </details>
          </li>
        </ol>
      </template>
    </section>
  </div>
</template>

<style scoped>
.activity-phases {
  margin-bottom: 0.65rem;
}
.wallet-section__heading > span {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.activity-ledger .wallet-section__heading {
  margin-bottom: 0.45rem;
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

details > summary {
  display: grid;
  grid-template-columns: minmax(150px, 1fr) auto auto auto;
  min-height: 88px;
  align-items: center;
  column-gap: 1rem;
  row-gap: 0.55rem;
  padding-block: 0.45rem;
  cursor: pointer;
  list-style: none;
}

details > summary::-webkit-details-marker {
  display: none;
}

.activity-copy,
.activity-amount {
  display: grid;
  gap: 0.32rem;
}

.activity-status {
  min-height: auto;
  padding: 0.12rem 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--text);
  font-size: 0.7rem;
  font-weight: 580;
  line-height: 1.35;
}

.activity-status :deep(.status-label__dot) {
  width: 5px;
  height: 5px;
}

.activity-copy small,
.activity-amount small {
  color: var(--text-muted);
  font-size: 0.7rem;
}

.activity-amount {
  min-width: 92px;
  justify-items: end;
}

.activity-caret {
  color: var(--text-muted);
  transition: transform 180ms var(--ease-standard);
}

details[open] .activity-caret {
  transform: rotate(180deg);
}

.activity-detail {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(0, 1.2fr);
  gap: clamp(1rem, 3vw, 2rem);
  padding: 0.2rem 0 1.25rem;
}

.activity-detail dl {
  display: grid;
  align-content: start;
  margin: 0;
}

.activity-detail dl > div {
  display: grid;
  grid-template-columns: 92px minmax(0, 1fr);
  gap: 0.75rem;
  padding-block: 0.45rem;
  border-bottom: 1px solid var(--hairline);
}

.activity-detail dt,
.activity-detail dd {
  font-size: 0.72rem;
}

.activity-detail dt {
  color: var(--text-muted);
}

.activity-detail dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.mono {
  font-family: var(--font-mono);
}

@keyframes activity-detail-enter {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@media (max-width: 680px) {
  details > summary {
    min-height: 0;
    grid-template-columns: minmax(0, 1fr) auto auto;
    padding-block: 1rem;
    row-gap: 0.72rem;
  }

  details > summary :deep(.status-label) {
    grid-column: 1;
    justify-self: start;
    margin-top: 0.08rem;
  }

  .activity-amount {
    grid-column: 2;
    grid-row: 1 / 3;
  }

  .activity-caret {
    grid-column: 3;
    grid-row: 1 / 3;
  }

  .activity-detail {
    grid-template-columns: 1fr;
  }
}

@media (prefers-reduced-motion: reduce) {
  .activity-detail {
    animation: none;
  }

  .activity-caret {
    transition-duration: 120ms;
  }
}
</style>
