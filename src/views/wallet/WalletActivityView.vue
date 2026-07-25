<script setup lang="ts">
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboard = useDashboardStore()
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      title="活动记录"
      description="这里只展示从真实账户更新得到的记录，不生成演示交易。"
    />
    <section class="wallet-surface">
      <div v-if="!dashboard.current.activities.length" class="wallet-empty">
        暂无活动。账户更新到达后会在这里按时间展示。
      </div>
      <dl v-else class="wallet-detail-list">
        <div v-for="item in dashboard.current.activities" :key="item.id">
          <dt>{{ item.status }}</dt>
          <dd>{{ item.title }} · {{ item.amount }} PGC</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
