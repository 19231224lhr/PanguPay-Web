<script setup lang="ts">
import {
  PhArrowRight as ArrowRight,
  PhCaretRight as CaretRight,
  PhCheckCircle as CheckCircle,
} from '@phosphor-icons/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import OrganizationDetailDialog from '@/components/OrganizationDetailDialog.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { navigateWithSpatialTransition } from '@/composables/useSpatialNavigation'
import { useWalletStore } from '@/stores/wallet'
import {
  formatWalletEntryError,
  hasLocalNoGroupChoice,
  rememberLocalNoGroupChoice,
  resolveOrganizationEntry,
  type OrganizationEntryDecision,
} from '@/wallet/entry'
import {
  getWalletEntryService,
  type WalletEntryOrganization,
  type WalletEntryOrganizationDetail,
} from '@/wallet/entryService'

const router = useRouter()
const wallet = useWalletStore()
const decision = ref<OrganizationEntryDecision>()
const organizations = ref<WalletEntryOrganization[]>([])
const selectedGroupId = ref('')
const busy = ref(true)
const error = ref('')
const stage = ref('正在恢复你的钱包状态')
const pendingAction = ref<'join' | 'retail'>()
const detailOpen = ref(false)
const detailOrganization = ref<WalletEntryOrganization>()
const organizationDetail = ref<WalletEntryOrganizationDetail>()
const detailBusy = ref(false)
const detailError = ref('')

const isChoosing = computed(() => decision.value?.kind === 'chooser')
const isRepairing = computed(() => decision.value?.kind === 'repair-no-group')
const fieldActive = computed(() => busy.value && !!decision.value)
const selectedOrganization = computed(() =>
  organizations.value.find((organization) => organization.id === selectedGroupId.value),
)

function enterWallet(): void {
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
    error.value = formatWalletEntryError(cause)
  } finally {
    busy.value = false
  }
}

async function chooseGroup(): Promise<void> {
  const service = getWalletEntryService()
  if (!service || !selectedGroupId.value) return
  busy.value = true
  pendingAction.value = 'join'
  error.value = ''
  stage.value = '正在提交加入申请并验证组织状态'
  try {
    await service.join(selectedGroupId.value)
    stage.value = '担保组织已连接'
    enterWallet()
  } catch (cause) {
    error.value = formatWalletEntryError(cause)
  } finally {
    busy.value = false
    pendingAction.value = undefined
  }
}

async function chooseNoGroup(): Promise<void> {
  const service = getWalletEntryService()
  if (!service) return
  busy.value = true
  pendingAction.value = 'retail'
  error.value = ''
  stage.value = '正在登记独立使用状态'
  try {
    await service.registerNoGroup()
    rememberLocalNoGroupChoice(wallet.accountId)
    stage.value = '独立使用状态已确认'
    enterWallet()
  } catch (cause) {
    error.value = formatWalletEntryError(cause)
  } finally {
    busy.value = false
    pendingAction.value = undefined
  }
}

async function loadOrganizationDetail(): Promise<void> {
  const service = getWalletEntryService()
  const organization = detailOrganization.value
  if (!service || !organization) return
  detailBusy.value = true
  detailError.value = ''
  organizationDetail.value = undefined
  try {
    organizationDetail.value = await service.organization(organization.id, organization.name)
  } catch (cause) {
    detailError.value = formatWalletEntryError(cause)
  } finally {
    detailBusy.value = false
  }
}

function showOrganizationDetail(organization: WalletEntryOrganization): void {
  detailOrganization.value = organization
  detailOpen.value = true
  void loadOrganizationDetail()
}

function closeOrganizationDetail(): void {
  detailOpen.value = false
}

onMounted(() => void restore())
</script>

<template>
  <WalletAccessFrame :field-active="fieldActive">
    <section class="access-panel wallet-entry" :class="{ 'wallet-entry--busy': busy }">
      <template v-if="isChoosing">
        <h1>选择你的使用方式</h1>
        <p>加入担保组织可使用快速转账与跨链；暂不加入仍可独立使用普通转账。</p>

        <div v-if="organizations.length" class="organization-list" aria-label="可加入的担保组织">
          <article
            v-for="organization in organizations"
            :key="organization.id"
            class="organization-choice"
          >
            <label>
              <input
                v-model="selectedGroupId"
                type="radio"
                name="organization"
                :value="organization.id"
                :aria-label="organization.name"
              />
              <span class="organization-choice__indicator" aria-hidden="true" />
              <span class="organization-choice__copy">
                <strong>{{ organization.name }}</strong>
                <small>组织 ID {{ organization.id }}</small>
                <span class="organization-choice__services"> <b>快速转账</b><b>跨链</b> </span>
              </span>
            </label>
            <button
              type="button"
              class="organization-choice__detail"
              :aria-label="`查看${organization.name}详情`"
              @click="showOrganizationDetail(organization)"
            >
              查看详情
              <CaretRight :size="15" />
            </button>
          </article>
        </div>

        <div v-else class="organization-empty">
          <strong>暂时没有可加入的担保组织</strong>
          <span>你仍可独立使用普通转账，之后再加入组织。</span>
        </div>

        <div class="entry-actions">
          <AppButton
            size="large"
            :disabled="busy || !selectedOrganization"
            :loading="pendingAction === 'join'"
            @click="chooseGroup"
          >
            加入所选组织
            <template #icon><ArrowRight :size="18" /></template>
          </AppButton>
          <AppButton
            size="large"
            variant="secondary"
            :disabled="busy"
            :loading="pendingAction === 'retail'"
            @click="chooseNoGroup"
          >
            暂不加入
          </AppButton>
        </div>
        <p class="entry-note">此选择决定当前可用的转账方式，进入钱包后仍可管理担保组织。</p>
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

    <OrganizationDetailDialog
      :open="detailOpen"
      :organization="detailOrganization"
      :detail="organizationDetail"
      :busy="detailBusy"
      :error="detailError"
      @close="closeOrganizationDetail"
      @retry="loadOrganizationDetail"
    />
  </WalletAccessFrame>
</template>

<style scoped>
.wallet-entry {
  align-content: center;
  min-height: min(440px, 100%);
  row-gap: 0;
}

.wallet-entry > h1 {
  margin: 0;
}

.wallet-entry > p {
  margin: 0.75rem 0 1.7rem;
}

.entry-mark {
  color: var(--accent);
}

.organization-list {
  display: grid;
  margin-bottom: 1.15rem;
  border-block: 1px solid var(--hairline);
}

.organization-choice {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.35rem;
  border-radius: var(--radius-md);
  transition: background var(--duration-state) var(--ease-standard);
}

.organization-choice + .organization-choice {
  border-top: 1px solid var(--hairline);
}

.organization-choice:has(input:checked) {
  background: color-mix(in srgb, var(--accent) 7%, transparent);
}

.organization-choice label {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.8rem;
  min-height: 80px;
  cursor: pointer;
}

.organization-choice input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.organization-choice__indicator {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-strong);
  border-radius: 50%;
  box-shadow: inset 0 0 0 5px transparent;
  transition:
    border-color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    box-shadow var(--duration-state) var(--ease-standard);
}

.organization-choice input:checked + .organization-choice__indicator {
  border-color: var(--accent);
  background: var(--accent);
  box-shadow: inset 0 0 0 5px var(--surface);
}

.organization-choice input:focus-visible + .organization-choice__indicator {
  outline: 3px solid var(--focus);
  outline-offset: 3px;
}

.organization-choice__copy {
  display: grid;
  min-width: 0;
  gap: 0.16rem;
}

.organization-choice__copy strong {
  font-size: 0.94rem;
  letter-spacing: -0.012em;
}

.organization-choice__copy small,
.entry-note,
.organization-empty span {
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.45;
}

.organization-choice__services {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding-top: 0.3rem;
}

.organization-choice__services b {
  padding: 0.18rem 0.42rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  color: var(--accent-strong);
  font-size: 0.66rem;
  font-weight: 650;
}

.organization-choice__detail {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  gap: 0.2rem;
  padding: 0 0.55rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 620;
  transition: color var(--duration-state) var(--ease-standard);
}

.organization-choice__detail:hover {
  color: var(--accent);
}

.entry-actions {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 0.8rem;
}

.entry-actions :deep(.app-button) {
  width: 100%;
}

.entry-note {
  margin: 0.7rem 0 0 !important;
}

.organization-empty {
  display: grid;
  gap: 0.25rem;
  padding: 1.1rem 0;
  border-block: 1px solid var(--hairline);
}

.entry-error {
  color: var(--danger) !important;
}

@media (prefers-reduced-motion: reduce) {
  .wallet-entry--busy {
    transition: none;
  }
}

@media (max-width: 560px) {
  .wallet-entry {
    min-height: 0;
    align-content: start;
    padding-bottom: 1.25rem;
  }

  .wallet-entry h1 {
    max-width: 8em;
    font-size: clamp(2.35rem, 11.5vw, 2.9rem);
    line-height: 1.02;
  }

  .wallet-entry > p {
    margin-block: 0.65rem 1.35rem;
  }

  .organization-list {
    gap: 0.75rem;
    margin-bottom: 1rem;
    border: 0;
  }

  .organization-choice {
    grid-template-columns: 1fr;
    gap: 0.2rem;
    padding: 0.9rem 1rem;
    border: 1px solid var(--hairline);
    border-radius: 18px;
  }

  .organization-choice + .organization-choice {
    border-top: 1px solid var(--hairline);
  }

  .organization-choice label {
    min-height: 0;
    align-items: start;
    padding-block: 0.15rem 0.55rem;
  }

  .organization-choice__detail {
    width: 100%;
    justify-content: space-between;
    justify-self: stretch;
    margin-top: 0;
    padding: 0.65rem 0 0.05rem;
    border-top: 1px solid var(--hairline);
  }

  .entry-actions {
    grid-template-columns: 1fr;
    gap: 0.7rem;
  }

  .entry-note {
    margin-top: 0.65rem !important;
  }
}
</style>
