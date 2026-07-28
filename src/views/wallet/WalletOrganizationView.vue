<script setup lang="ts">
import { onMounted, ref } from 'vue'

import AppButton from '@/components/AppButton.vue'
import InlineNotice from '@/components/InlineNotice.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { getWalletEntryService, type WalletEntryOrganization } from '@/wallet/entryService'

const dashboard = useDashboardStore()
const organizations = ref<WalletEntryOrganization[]>([])
const selected = ref('')
const loading = ref(false)
const error = ref('')

async function loadOrganizations(): Promise<void> {
  if (dashboard.current.organization || loading.value) return
  const service = getWalletEntryService()
  if (!service) {
    error.value = '组织服务尚未连接。'
    return
  }
  loading.value = true
  error.value = ''
  try {
    organizations.value = await service.listOrganizations()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法读取担保组织。'
  } finally {
    loading.value = false
  }
}

async function join(): Promise<void> {
  const service = getWalletEntryService()
  if (!service || !selected.value) return
  loading.value = true
  error.value = ''
  try {
    await service.join(selected.value)
    await dashboard.sync(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加入担保组织失败。'
  } finally {
    loading.value = false
  }
}

onMounted(() => void loadOrganizations())
</script>

<template>
  <div class="wallet-page organization-page">
    <WalletPageHeader
      title="担保组织"
      description="普通转账可以独立使用；加入组织后可使用 TXCer 快速转账与跨链。"
    />

    <section
      v-if="dashboard.current.organization"
      class="wallet-section"
      aria-labelledby="organization-state-heading"
    >
      <div class="wallet-section__heading"><h2 id="organization-state-heading">当前归属</h2></div>
      <dl class="wallet-detail-list organization-details">
        <div>
          <dt>组织名称</dt>
          <dd>{{ dashboard.current.organization.name }}</dd>
        </div>
        <div>
          <dt>组织 ID</dt>
          <dd class="mono">{{ dashboard.current.organization.id }}</dd>
        </div>
        <div>
          <dt>当前角色</dt>
          <dd>{{ dashboard.current.organization.role }}</dd>
        </div>
      </dl>
      <InlineNotice title="快速能力已启用" tone="info">
        发送页现在可以选择快速和跨链路径；后台认证不会阻塞 TXCer 快速可用。
      </InlineNotice>
    </section>

    <section v-else class="organization-chooser" aria-labelledby="available-organizations-heading">
      <div class="wallet-section__heading">
        <h2 id="available-organizations-heading">选择担保组织</h2>
        <span>可稍后加入</span>
      </div>
      <p class="organization-copy">你目前以独立账户使用普通转账。加入不会更换账户或地址。</p>
      <div v-if="organizations.length" class="organization-options">
        <label
          v-for="item in organizations"
          :key="item.id"
          :data-selected="selected === item.id || undefined"
        >
          <input v-model="selected" type="radio" name="wallet-organization" :value="item.id" />
          <span
            ><strong>{{ item.name }}</strong
            ><small>{{ item.description || item.id }}</small></span
          >
        </label>
      </div>
      <div v-else-if="!loading" class="wallet-empty">当前没有可加入的担保组织。</div>
      <InlineNotice v-if="error" title="无法完成组织连接" tone="danger">{{ error }}</InlineNotice>
      <div class="organization-actions">
        <AppButton variant="secondary" :loading="loading" @click="loadOrganizations"
          >刷新列表</AppButton
        >
        <AppButton :disabled="!selected" :loading="loading" @click="join">确认加入</AppButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.organization-page {
  width: min(760px, 100%);
}
.organization-details {
  margin-bottom: 1rem;
}
.organization-chooser {
  display: grid;
  gap: 1rem;
}
.wallet-section__heading > span,
.organization-copy {
  color: var(--text-muted);
  font-size: 0.78rem;
}
.organization-copy {
  margin: 0;
  line-height: 1.55;
}
.organization-options {
  display: grid;
  border-block: 1px solid var(--hairline);
}
.organization-options label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: start;
  gap: 0.75rem;
  min-height: 70px;
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid var(--hairline);
  cursor: pointer;
  transition: background var(--duration-state) var(--ease-standard);
}
.organization-options label:last-child {
  border-bottom: 0;
}
.organization-options label[data-selected] {
  background: var(--selection-lens);
}
.organization-options input {
  width: 18px;
  height: 18px;
  margin-top: 0.1rem;
  accent-color: var(--accent);
}
.organization-options span {
  display: grid;
  gap: 0.15rem;
}
.organization-options small {
  color: var(--text-muted);
  font-size: 0.74rem;
}
.organization-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.7rem;
}
.mono {
  font-family: var(--font-mono);
}
@media (max-width: 599px) {
  .organization-actions {
    display: grid;
    grid-template-columns: 1fr;
  }
}
</style>
