<script setup lang="ts">
import { computed } from 'vue'

import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { useTransferStore } from '@/stores/transfer'

const dashboard = useDashboardStore()
const transfer = useTransferStore()

const phaseLabels = {
  review: '待审核',
  submitting: '正在提交',
  accepted: '入口已接收',
  'spend-ready': 'TXCer 可用',
  settled: '后台已结算',
  failed: '失败',
} as const

const assetSymbol = (coinType?: number, explicit?: string) =>
  explicit || ['PGC', 'BTC', 'ETH'][coinType ?? 0] || `Asset ${coinType ?? 0}`

const activities = computed(() => {
  const merged = new Map<string, (typeof dashboard.current.activities)[number] & { txID: string }>()
  for (const item of dashboard.current.activities) merged.set(item.id, { ...item, txID: item.id })
  for (const item of transfer.history) {
    merged.set(item.txID, {
      id: item.txID,
      title: `${item.mode === 'quick' ? '快速' : item.mode === 'cross' ? '跨链' : '普通'}转账`,
      amount: item.amount,
      coinType: item.coinType,
      asset: assetSymbol(item.coinType),
      status: phaseLabels[item.phase],
      timestamp: item.updatedAt,
      txID: item.txID,
      direction: 'out' as const,
    })
  }
  return [...merged.values()].sort((left, right) => right.timestamp - left.timestamp)
})
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      title="活动记录"
      description="这里只展示从真实账户更新得到的记录，不生成演示交易。"
    />
    <section class="wallet-section activity-ledger" aria-labelledby="activity-list-heading">
      <div class="wallet-section__heading">
        <h2 id="activity-list-heading">全部记录</h2>
        <span>{{ activities.length }} 项</span>
      </div>
      <div v-if="!activities.length" class="wallet-empty">
        暂无活动。账户更新到达后会在这里按时间展示。
      </div>
      <ol v-else>
        <li v-for="item in activities" :key="`${item.id}-${item.status}`">
          <span>
            <b>{{ item.title }}</b>
            <small>{{ item.status }} · {{ item.txID.slice(0, 12) }}…</small>
          </span>
          <b class="tabular"
            >{{ item.direction === 'out' ? '−' : '+' }}{{ item.amount }}
            {{ assetSymbol(item.coinType, item.asset) }}</b
          >
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

ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

li {
  display: flex;
  min-height: 70px;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-bottom: 1px solid var(--hairline);
}

li:last-child {
  border-bottom: 0;
}

li > span {
  display: grid;
  gap: 0.2rem;
}

li small {
  color: var(--text-muted);
}
</style>
