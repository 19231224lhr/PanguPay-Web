<script setup lang="ts">
import {
  PhArchive as Archive,
  PhCheck as Check,
  PhCopy as Copy,
  PhPlus as Plus,
  PhX as Close,
} from '@phosphor-icons/vue'
import { computed, ref } from 'vue'

import { addAmounts } from '@/protocol-v2/amount'
import { GatewayClient } from '@/services/gatewayClient'
import { buildWalletReOnlineMessage } from '@/services/walletEntryGateway'
import { loadTransferJournal } from '@/transfer/journal'
import { loadTransferReservations } from '@/transfer/reservations'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import { assetIdentityForType } from '@/wallet/dashboard'
import { evaluateAddressArchive, resolveAddressArchiveActivity } from '@/wallet/addressBook'
import { getWalletEntryService } from '@/wallet/entryService'
import { loadWalletSpendableSnapshot } from '@/wallet/spendable'
import AppButton from './AppButton.vue'
import WalletFigure from './WalletFigure.vue'
import AppSelect from './AppSelect.vue'
import FormField from './FormField.vue'

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const creating = ref(false)
const createBusy = ref(false)
const archiveBusy = ref(false)
const archiveChecking = ref(false)
const archiveInputOwners = ref<Record<string, string>>({})
const type = ref('0')
const password = ref('')
const error = ref('')
const copied = ref('')
const archiveAddress = ref('')

const typeOptions = [
  { value: '0', label: 'PGC', description: 'Pangu Coin · Transfer Area' },
  { value: '1', label: 'BTC', description: 'Bitcoin · Transfer Area' },
  { value: '2', label: 'ETH', description: 'Ethereum · Transfer Area' },
]

const rows = computed(() =>
  wallet.addresses.map((record) => {
    const balance = dashboard.current.addresses.find((item) => item.address === record.address)
    const metadata = wallet.metadata?.addresses[record.address]
    const asset = assetIdentityForType(record.type)
    return {
      ...record,
      ...asset,
      label: metadata?.label || `${asset.symbol} 地址`,
      archived: metadata?.archived ?? false,
      registration: metadata?.registration ?? 'active',
      registrationError: metadata?.error,
      utxo: balance?.balance ?? '0',
      txCer: balance?.txCerBalance ?? '0',
      total: addAmounts(balance?.balance ?? '0', balance?.txCerBalance ?? '0'),
    }
  }),
)

const activeCount = computed(() => rows.value.filter((item) => !item.archived).length)
const selectedArchive = computed(() =>
  rows.value.find((item) => item.address === archiveAddress.value),
)
const archiveActivity = computed(() => {
  const row = selectedArchive.value
  if (!row) return { hasReservedInputs: false, hasPendingTransfers: false, ownershipUnknown: false }
  let activity = {
    hasReservedInputs: false,
    hasPendingTransfers: false,
    ownershipUnknown: false,
  }
  try {
    activity = resolveAddressArchiveActivity({
      address: row.address,
      transfers: loadTransferJournal(wallet.accountId),
      reservations: loadTransferReservations(wallet.accountId),
      inputOwners: archiveInputOwners.value,
    })
  } catch {
    activity.ownershipUnknown = true
  }
  return activity
})
const archiveDecision = computed(() => {
  const row = selectedArchive.value
  if (!row) return undefined
  return evaluateAddressArchive({
    isLastActive: !row.archived && activeCount.value <= 1,
    utxoBalance: row.utxo,
    txCerBalance: row.txCer,
    ...archiveActivity.value,
    isOrganizationMember: !!dashboard.current.organization,
  })
})

async function openArchive(address: string): Promise<void> {
  archiveAddress.value = address
  archiveInputOwners.value = {}
  if (!archiveActivity.value.ownershipUnknown) return
  const record = wallet.activeRecord
  if (!record) return
  archiveChecking.value = true
  try {
    const snapshot = await loadWalletSpendableSnapshot(new GatewayClient(), {
      userID: wallet.accountId,
      addresses: wallet.activeAddresses.map((item) => item.address),
      reOnlineMessage: buildWalletReOnlineMessage(record),
      receivedTXCers: dashboard.current.receivedTXCers,
    })
    archiveInputOwners.value = Object.fromEntries(
      [...snapshot.utxos, ...snapshot.txCers].map((item) => [item.id, item.address]),
    )
  } catch {
    // Unknown legacy ownership stays fail-closed; current records carry sourceAddress directly.
  } finally {
    archiveChecking.value = false
  }
}

async function copyAddress(address: string): Promise<void> {
  await navigator.clipboard.writeText(address)
  copied.value = address
  window.setTimeout(() => copied.value === address && (copied.value = ''), 1_500)
}

async function register(address: string): Promise<void> {
  const service = getWalletEntryService()
  if (!service) throw new Error('地址登记服务尚未连接。')
  await service.registerAddress(address, dashboard.current.organization?.id)
  await wallet.setAddressMetadata(address, { registration: 'active', error: undefined })
}

async function createAddress(): Promise<void> {
  if (!password.value || createBusy.value) return
  const walletPassword = password.value
  password.value = ''
  createBusy.value = true
  error.value = ''
  try {
    const address = await wallet.addAddress(Number(type.value), walletPassword)
    try {
      await register(address.address)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '地址登记失败。'
      await wallet.setAddressMetadata(address.address, { registration: 'failed', error: message })
      throw cause
    }
    creating.value = false
    await dashboard.sync(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法新建地址。'
  } finally {
    createBusy.value = false
  }
}

async function retryRegistration(address: string): Promise<void> {
  error.value = ''
  try {
    await wallet.setAddressMetadata(address, { registration: 'pending', error: undefined })
    await register(address)
    await dashboard.sync(true)
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : '地址登记失败。'
    await wallet.setAddressMetadata(address, { registration: 'failed', error: message })
    error.value = message
  }
}

async function confirmArchive(): Promise<void> {
  const row = selectedArchive.value
  const decision = archiveDecision.value
  if (!row || !decision?.allowed || archiveBusy.value) return
  archiveBusy.value = true
  error.value = ''
  try {
    if (decision.requiresNetworkUnbind) {
      const service = getWalletEntryService()
      if (!service) throw new Error('地址解绑服务尚未连接。')
      await service.unbindAddress(row.address, dashboard.current.organization?.id)
    }
    await wallet.setAddressMetadata(row.address, { archived: true })
    archiveAddress.value = ''
    await dashboard.sync(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '无法归档地址。'
  } finally {
    archiveBusy.value = false
  }
}
</script>

<template>
  <section class="address-ledger" aria-label="收款地址明细">
    <header class="ledger-heading">
      <h2 tabindex="-1">完整收款地址账本</h2>
      <span>{{ rows.length }} 个地址</span>
    </header>
    <p v-if="!rows.length" class="ledger-empty">暂无收款地址。</p>
    <div v-else class="address-table">
      <article
        v-for="row in rows"
        :key="row.address"
        :data-address="row.address"
        tabindex="-1"
        :data-archived="row.archived || undefined"
      >
        <div class="ledger-record-body">
          <div class="ledger-record-copy">
            <div class="address-asset">
              <div class="address-identity">
                <strong>{{ row.label }}</strong>
                <span v-if="row.archived" class="address-badge">已归档</span>
                <span
                  v-else-if="row.registration === 'active'"
                  class="address-badge"
                  data-tone="success"
                  >已登记</span
                >
                <button
                  v-else-if="row.registration === 'failed'"
                  type="button"
                  class="registration-retry"
                  data-tone="danger"
                  @click="retryRegistration(row.address)"
                >
                  登记失败 · 重试
                </button>
                <span v-else class="address-badge">登记中</span>
              </div>
              <small>{{ row.name }} · {{ row.network }}</small>
            </div>
            <div class="address-identifier">
              <span class="field-label">收款地址</span><code>{{ row.address }}</code>
            </div>
            <dl class="address-balances">
              <div>
                <dt>地址余额</dt>
                <dd class="tabular">
                  {{ row.total }} <small>{{ row.symbol }}</small>
                </dd>
              </div>
              <div>
                <dt>UTXO</dt>
                <dd class="tabular">{{ row.utxo }}</dd>
              </div>
              <div>
                <dt>TXCer</dt>
                <dd class="tabular">{{ row.txCer }}</dd>
              </div>
            </dl>
            <p v-if="row.registrationError" class="registration-error">
              {{ row.registrationError }}
            </p>
          </div>
          <WalletFigure kind="format" :intensity="0.3" />
        </div>
        <div class="address-actions">
          <button type="button" :aria-label="`复制 ${row.label}`" @click="copyAddress(row.address)">
            <Check v-if="copied === row.address" :size="15" aria-hidden="true" /><Copy
              v-else
              :size="15"
              aria-hidden="true"
            />
            <span>{{ copied === row.address ? '已复制' : '复制' }}</span>
          </button>
          <button
            v-if="!row.archived"
            type="button"
            class="archive-trigger"
            :aria-label="`归档 ${row.label}`"
            @click="openArchive(row.address)"
          >
            <Archive :size="15" aria-hidden="true" />归档
          </button>
        </div>
      </article>
    </div>

    <footer class="ledger-toolbar">
      <p class="ledger-counts">
        <span
          ><b>{{ activeCount }}</b> 个在用</span
        ><span v-if="rows.length > activeCount">{{ rows.length - activeCount }} 个已归档</span>
      </p>
      <AppButton
        class="create-toggle"
        variant="secondary"
        :aria-expanded="creating"
        @click="creating = !creating"
      >
        {{ creating ? '收起' : '新建地址' }}
        <template #icon><Close v-if="creating" :size="16" /><Plus v-else :size="16" /></template>
      </AppButton>
    </footer>
    <Transition name="ledger-reveal">
      <form v-if="creating" class="address-create" @submit.prevent="createAddress">
        <AppSelect id="new-address-type" v-model="type" label="币种" :options="typeOptions" />
        <FormField
          id="new-address-password"
          v-model="password"
          label="钱包密码"
          type="password"
          autocomplete="current-password"
        />
        <AppButton type="submit" :loading="createBusy" :disabled="password.length < 12">
          生成并登记
        </AppButton>
      </form>
    </Transition>

    <Transition name="ledger-reveal">
      <div v-if="selectedArchive" class="archive-confirm" role="dialog" aria-modal="true">
        <div>
          <strong>归档 {{ selectedArchive.label }}？</strong>
          <p>密钥与 RootSeed 仍保留在加密备份中；归档后不会再用于收款或选币。</p>
          <ul v-if="archiveDecision?.reasons.length">
            <li v-for="reason in archiveDecision.reasons" :key="reason">{{ reason }}</li>
          </ul>
        </div>
        <div>
          <AppButton variant="ghost" @click="archiveAddress = ''">取消</AppButton>
          <AppButton
            variant="danger"
            :disabled="archiveChecking || !archiveDecision?.allowed"
            :loading="archiveBusy || archiveChecking"
            @click="confirmArchive"
          >
            确认归档
          </AppButton>
        </div>
      </div>
    </Transition>

    <p v-if="error" class="address-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.address-ledger {
  display: grid;
  min-width: 0;
}
.ledger-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.5rem 1.25rem;
  border-top: 1px solid var(--hairline);
}
.ledger-counts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin: 0;
  color: var(--text-muted);
  font-size: 0.7rem;
}
.ledger-counts b {
  color: var(--text);
  font-weight: 500;
}
.create-toggle {
  min-height: 36px;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  font-size: 0.75rem;
}
.address-create {
  display: grid;
  grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.2fr) auto;
  align-items: end;
  gap: 1rem;
  margin: 0 1.25rem;
  padding: 1rem 0;
  border-top: 1px solid var(--hairline);
}
.address-table {
  display: grid;
}
.address-table article {
  scroll-margin-block: 5rem;
  min-width: 0;
  padding: 0.75rem 1.25rem;
  border-top: 1px solid var(--hairline);
  outline: none;
  --figure-plate: var(--overview-panel-surface, var(--surface));
}
.ledger-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem 1.25rem;
  min-height: 60px;
}
.ledger-heading h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 600;
}
.ledger-heading > span {
  font-size: 0.7rem;
  color: var(--text-muted);
}
.ledger-record-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--overview-figure-width, 112px);
  gap: 1rem;
  align-items: center;
}
.ledger-record-body > .wallet-figure {
  width: var(--overview-figure-width, 112px);
  justify-self: end;
}
.ledger-record-copy {
  display: grid;
  min-width: 0;
  gap: 0.75rem;
}
.address-balances {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1rem;
  margin: 0;
  max-width: 440px;
}
.address-balances dt,
.field-label {
  color: var(--text-muted);
  font-size: 0.7rem;
}
.address-balances dd {
  margin: 0.3rem 0 0;
  font-size: 1.25rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.registration-error {
  color: var(--danger);
  font-size: 0.75rem;
  margin: 0;
}
.address-table article:last-child {
  border-radius: 0 0 16px 16px;
}
.address-table article:focus {
  background: color-mix(in srgb, var(--accent) 5%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
}
.address-table article[data-archived] .address-asset,
.address-table article[data-archived] .address-balances {
  color: var(--text-muted);
}
.address-asset {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}
.address-identity {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  min-height: 24px;
}
.address-identity strong {
  font-size: 0.85rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}
small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.5;
}
.address-badge {
  padding: 0.15rem 0.4rem;
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--text-muted);
  background: var(--surface-hover);
  border-radius: 6px;
}
.address-badge[data-tone='success'] {
  color: var(--success);
  background: color-mix(in srgb, var(--success) 8%, transparent);
}
.registration-retry {
  min-height: 36px;
  padding: 0 0.4rem;
  color: var(--danger);
  background: transparent;
  cursor: pointer;
  font-size: 0.7rem;
}
.address-identifier {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.address-identifier code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text);
  font: 0.75rem/1.6 var(--font-mono);
}
.address-actions {
  margin-top: 0.5rem;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 0.5rem;
}
.address-actions button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  gap: 0.35rem;
  padding: 0.4rem 0.5rem;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
  font-size: 0.7rem;
  cursor: pointer;
}
.address-actions button:hover {
  color: var(--text);
  background: var(--surface-hover);
}
.address-actions .archive-trigger:hover {
  color: var(--danger);
}
.archive-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 1.25rem 1rem;
  padding: 1rem;
  border-radius: 12px;
  background: color-mix(in srgb, var(--danger) 7%, var(--surface));
}
.archive-confirm strong {
  font-size: 0.85rem;
}
.archive-confirm p,
.archive-confirm ul {
  margin: 0.4rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.6;
}
.archive-confirm > div:last-child {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}
.address-error,
.ledger-empty {
  margin: 0;
  padding: 1rem 1.25rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}
.address-error {
  color: var(--danger);
}
.ledger-reveal-enter-active,
.ledger-reveal-leave-active {
  transition:
    opacity 180ms var(--ease-standard),
    transform 180ms var(--ease-standard);
}
.ledger-reveal-enter-from,
.ledger-reveal-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
@container (max-width: 680px) {
  .address-create {
    grid-template-columns: 1fr;
  }
  .archive-confirm {
    align-items: stretch;
    flex-direction: column;
  }
  .archive-confirm > div:last-child {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
@container (max-width: 440px) {
  .ledger-heading,
  .ledger-toolbar,
  .address-table article {
    padding-inline: 1rem;
  }
  .address-table article {
    gap: 0.75rem;
  }
  .ledger-record-body {
    --overview-figure-width: 96px;
    gap: 0.75rem;
  }
  .address-balances {
    gap: 0.5rem;
  }
  .address-balances dd {
    font-size: 1rem;
  }
  .address-create {
    margin-inline: 1rem;
  }
}
@media (pointer: coarse) {
  .address-actions button,
  .create-toggle,
  .registration-retry {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ledger-reveal-enter-active,
  .ledger-reveal-leave-active {
    transition: none;
  }
  .ledger-reveal-enter-from,
  .ledger-reveal-leave-to {
    transform: none;
  }
}
</style>
