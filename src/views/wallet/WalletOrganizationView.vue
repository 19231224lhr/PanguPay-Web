<script setup lang="ts">
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'

const dashboard = useDashboardStore()
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      title="担保组织"
      description="展示地址当前绑定的真实担保组织；未加入时提供清晰状态，而不是模拟组织。"
    />
    <section class="wallet-surface">
      <dl v-if="dashboard.current.organization" class="wallet-detail-list">
        <div>
          <dt>组织名称</dt>
          <dd>{{ dashboard.current.organization.name }}</dd>
        </div>
        <div>
          <dt>组织 ID</dt>
          <dd>{{ dashboard.current.organization.id }}</dd>
        </div>
        <div>
          <dt>当前角色</dt>
          <dd>{{ dashboard.current.organization.role }}</dd>
        </div>
      </dl>
      <div v-else class="wallet-empty">
        当前地址尚未查询到担保组织。加入、切换和管理流程将在后续业务阶段接入。
      </div>
    </section>
  </div>
</template>
