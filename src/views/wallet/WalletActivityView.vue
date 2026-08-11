<script setup lang="ts">
import { PhCaretDown as CaretDown } from '@phosphor-icons/vue'
import { computed, onMounted } from 'vue'

import ActivityProgress from '@/components/ActivityProgress.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useTransferStore } from '@/stores/transfer'
import {
  transferActivityStatus,
  transferModeLabel,
  type TransferMode,
  type TransferPhase,
} from '@/transfer'
import type { WalletActivity } from '@/wallet/types'

const dashboard = useDashboardStore()
const transfer = useTransferStore()

onMounted(() => void transfer.synchronizeHistory(true))

interface ActivityRow extends WalletActivity {
  txID: string
  mode?: TransferMode
  phase?: TransferPhase
  lightTxHash?: string
  targetBlock?: number
  crossChainError?: string
}

const assetSymbol = (coinType?: number, explicit?: string) =>
  explicit || ['PGC', 'BTC', 'ETH'][coinType ?? 0] || `Asset ${coinType ?? 0}`

const formatTime = (value: number) =>
  value
    ? new Intl.DateTimeFormat('zh-CN', {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: false,
      }).format(value)
    : '时间未知'

const activities = computed<ActivityRow[]>(() => {
  const merged = new Map<string, ActivityRow>()
  for (const item of dashboard.current.activities) merged.set(item.id, { ...item, txID: item.id })
  for (const item of transfer.history) {
    merged.set(item.txID, {
      id: item.txID,
      title: transferModeLabel(item.mode),
      amount: item.amount,
      coinType: item.coinType,
      asset: assetSymbol(item.coinType),
      status: transferActivityStatus(item.mode, item.phase, item.crossChainError),
      timestamp: item.updatedAt,
      txID: item.txID,
      direction: 'out',
      mode: item.mode,
      phase: item.phase,
      lightTxHash: item.lightTxHash,
      targetBlock: item.targetBlock,
      crossChainError: item.crossChainError,
    })
  }
  return [...merged.values()].sort((left, right) => right.timestamp - left.timestamp)
})

const statusTone = (item: ActivityRow) =>
  item.phase === 'failed' || item.crossChainError || /失败|恢复|rejected/i.test(item.status)
    ? 'danger'
    : item.phase === 'settled' || /结算|confirm|success/i.test(item.status)
      ? 'success'
      : 'neutral'
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      title="活动记录"
      description="入口接收、快速可用和后台结算分开显示；记录来自真实账户状态与本机提交日志。"
    />
    <section class="wallet-section activity-ledger" aria-labelledby="activity-list-heading">
      <div class="wallet-section__heading">
        <h2 id="activity-list-heading">全部活动</h2>
        <span>{{ activities.length }} 条</span>
      </div>
      <div v-if="!activities.length" class="wallet-empty">
        还没有可显示的真实活动。完成一笔转账后，入口、快速可用与后台结算会分别记录。
      </div>
      <ol v-else>
        <li v-for="item in activities" :key="`${item.id}-${item.status}`">
          <details>
            <summary>
              <span class="activity-copy">
                <b>{{ item.title }}</b>
                <small>{{ formatTime(item.timestamp) }}</small>
              </span>
              <StatusLabel class="activity-status" :tone="statusTone(item)">
                {{ item.status }}
              </StatusLabel>
              <span class="activity-amount">
                <b class="tabular">{{ item.direction === 'out' ? '−' : '+' }}{{ item.amount }}</b>
                <small>{{ assetSymbol(item.coinType, item.asset) }}</small>
              </span>
              <CaretDown class="activity-caret" :size="17" aria-hidden="true" />
            </summary>
            <div class="activity-detail">
              <ActivityProgress
                :mode="item.mode"
                :phase="item.phase"
                :status="item.status"
                :light-tx-hash="item.lightTxHash"
                :target-block="item.targetBlock"
                :cross-chain-error="item.crossChainError"
              />
              <dl>
                <div>
                  <dt>方向</dt>
                  <dd>{{ item.direction === 'out' ? '转出' : '转入' }}</dd>
                </div>
                <div v-if="item.mode">
                  <dt>路径</dt>
                  <dd>
                    {{ transferModeLabel(item.mode) }}
                  </dd>
                </div>
                <div>
                  <dt>完整交易 ID</dt>
                  <dd class="mono">{{ item.txID }}</dd>
                </div>
              </dl>
            </div>
          </details>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
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
  animation: activity-detail-enter 180ms var(--ease-standard) both;
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
