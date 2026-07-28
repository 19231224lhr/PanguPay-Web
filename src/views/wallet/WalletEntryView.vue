<script setup lang="ts">
import { PhArrowRight as ArrowRight, PhCheckCircle as CheckCircle } from '@phosphor-icons/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'
import { useWalletStore } from '@/stores/wallet'
import {
  hasLocalNoGroupChoice,
  rememberLocalNoGroupChoice,
  resolveOrganizationEntry,
  type OrganizationEntryDecision,
} from '@/wallet/entry'
import { getWalletEntryService, type WalletEntryOrganization } from '@/wallet/entryService'

const router = useRouter()
const wallet = useWalletStore()
const decision = ref<OrganizationEntryDecision>()
const organizations = ref<WalletEntryOrganization[]>([])
const selectedGroupId = ref('')
const busy = ref(true)
const error = ref('')
const stage = ref('正在恢复你的钱包状态')

const isChoosing = computed(() => decision.value?.kind === 'chooser')
const isRepairing = computed(() => decision.value?.kind === 'repair-no-group')
const fieldActive = computed(() => busy.value && !!decision.value)

function enterWallet(): void {
  sessionStorage.setItem('pangupay-wallet-entry-arrival', '1')
  void navigateWithSpatialTransition(router, '/wallet', 'wallet')
}

async function restore(): Promise<void> {
  const service = getWalletEntryService()
  if (!service) {
    busy.value = false
    error.value = '网络连接正在配置中，请稍后重试。'
    return
  }
  try {
    decision.value = resolveOrganizationEntry({
      ...(await service.recover()),
      localSkipped: hasLocalNoGroupChoice(wallet.accountId),
    })
    if (decision.value.kind === 'inconsistent') {
      error.value = '地址的组织状态不一致，已停止进入钱包以保护资产。'
      return
    }
    if (decision.value.kind === 'chooser') {
      organizations.value = await service.listOrganizations()
      return
    }
    if (decision.value.kind === 'member') stage.value = '已恢复担保组织连接'
    if (decision.value.kind === 'no-group') {
      rememberLocalNoGroupChoice(wallet.accountId)
      stage.value = '已恢复独立使用状态'
    }
    if (decision.value.kind === 'repair-no-group') stage.value = '需要重新确认独立使用状态'
    if (decision.value.kind !== 'repair-no-group') enterWallet()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法恢复组织状态。'
  } finally {
    busy.value = false
  }
}

async function chooseGroup(): Promise<void> {
  const service = getWalletEntryService()
  if (!service || !selectedGroupId.value) return
  busy.value = true
  error.value = ''
  stage.value = '正在提交加入申请并验证组织状态'
  try {
    await service.join(selectedGroupId.value)
    stage.value = '担保组织已连接'
    enterWallet()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '加入担保组织失败。'
  } finally {
    busy.value = false
  }
}

async function chooseNoGroup(): Promise<void> {
  const service = getWalletEntryService()
  if (!service) return
  busy.value = true
  error.value = ''
  stage.value = '正在登记独立使用状态'
  try {
    await service.registerNoGroup()
    rememberLocalNoGroupChoice(wallet.accountId)
    stage.value = '独立使用状态已确认'
    enterWallet()
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法登记独立使用状态。'
  } finally {
    busy.value = false
  }
}

onMounted(() => void restore())
</script>

<template>
  <WalletAccessFrame :field-active="fieldActive">
    <section class="access-panel wallet-entry" :class="{ 'wallet-entry--busy': busy }">
      <template v-if="isChoosing">
        <h1>选择你的使用方式</h1>
        <p>加入担保组织可使用快速转账与跨链；暂不加入仍可独立使用普通转账。</p>

        <label
          v-for="organization in organizations"
          :key="organization.id"
          class="organization-choice"
        >
          <input
            v-model="selectedGroupId"
            type="radio"
            name="organization"
            :value="organization.id"
          />
          <span>
            <strong>{{ organization.name }}</strong>
            <small>{{ organization.description || '支持快速转账与跨链服务。' }}</small>
          </span>
        </label>

        <AppButton size="large" :disabled="!selectedGroupId" :loading="busy" @click="chooseGroup">
          加入担保组织
          <template #icon><ArrowRight :size="18" /></template>
        </AppButton>
        <button type="button" class="entry-text-action" @click="chooseNoGroup">
          暂不加入，独立使用
        </button>
      </template>

      <template v-else-if="isRepairing">
        <h1>确认独立使用状态</h1>
        <p>我们没有在网络上找到这台钱包的地址登记。确认后可以继续独立使用。</p>
        <AppButton size="large" :loading="busy" @click="chooseNoGroup">
          确认并进入钱包
          <template #icon><ArrowRight :size="18" /></template>
        </AppButton>
      </template>

      <template v-else-if="error">
        <h1>无法进入钱包</h1>
        <p class="entry-error" role="alert">{{ error }}</p>
        <AppButton size="large" @click="restore">重新尝试</AppButton>
      </template>

      <template v-else>
        <CheckCircle class="entry-mark" :size="34" weight="regular" />
        <h1>正在准备钱包</h1>
        <p>{{ stage }}</p>
      </template>
    </section>
  </WalletAccessFrame>
</template>

<style scoped>
.wallet-entry {
  align-content: center;
  min-height: min(440px, 100%);
}

.entry-mark {
  color: var(--accent);
}

.organization-choice {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.9rem 0;
  border-top: 1px solid var(--hairline);
  cursor: pointer;
}

.organization-choice:last-of-type {
  border-bottom: 1px solid var(--hairline);
}

.organization-choice input {
  width: 18px;
  height: 18px;
  margin-top: 0.12rem;
  accent-color: var(--accent);
}

.organization-choice span {
  display: grid;
  gap: 0.18rem;
}

.organization-choice small,
.entry-text-action {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.entry-text-action {
  min-height: 44px;
  border: 0;
  background: transparent;
  cursor: pointer;
  text-align: left;
}

.entry-text-action:hover {
  color: var(--accent);
}

.entry-error {
  color: var(--danger) !important;
}

@media (prefers-reduced-motion: reduce) {
  .wallet-entry--busy {
    transition: none;
  }
}
</style>
