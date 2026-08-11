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
  <section class="address-ledger" aria-labelledby="address-ledger-heading">
    <header>
      <div>
        <p>地址账本</p>
        <h2 id="address-ledger-heading">你的收款地址</h2>
      </div>
      <AppButton variant="secondary" @click="creating = !creating">
        {{ creating ? '收起' : '新建地址' }}
        <template #icon><Close v-if="creating" :size="16" /><Plus v-else :size="16" /></template>
      </AppButton>
    </header>

    <Transition name="ledger-reveal">
      <form v-if="creating" class="address-create" @submit.prevent="createAddress">
        <AppSelect id="new-address-type" v-model="type" label="币种" :options="typeOptions" />
        <FormField
          id="new-address-password"
          v-model="password"
          label="钱包密码"
          type="password"
          autocomplete="current-password"
          help="用于重新加密包含新 RootSeed 的本地 keystore。"
        />
        <AppButton type="submit" :loading="createBusy" :disabled="password.length < 12">
          生成并登记
        </AppButton>
      </form>
    </Transition>

    <div class="address-table">
      <article v-for="row in rows" :key="row.address" :data-archived="row.archived || undefined">
        <div class="address-asset" :data-symbol="row.symbol">
          <span>{{ row.symbol.slice(0, 1) }}</span>
          <div>
            <strong>{{ row.label }}</strong
            ><small>{{ row.name }} · {{ row.network }}</small>
          </div>
        </div>
        <div class="address-value">
          <strong class="tabular">{{ row.total }} {{ row.symbol }}</strong>
          <small>UTXO {{ row.utxo }} · TXCer {{ row.txCer }}</small>
        </div>
        <div class="address-identifier">
          <code>{{ row.address }}</code>
          <button type="button" :aria-label="`复制 ${row.label}`" @click="copyAddress(row.address)">
            <Check v-if="copied === row.address" :size="17" />
            <Copy v-else :size="17" />
          </button>
        </div>
        <div class="address-state">
          <span v-if="row.archived">已归档</span>
          <span v-else-if="row.registration === 'active'" data-tone="success">已登记</span>
          <button
            v-else-if="row.registration === 'failed'"
            type="button"
            data-tone="danger"
            @click="retryRegistration(row.address)"
          >
            登记失败 · 重试
          </button>
          <span v-else>登记中</span>
          <button
            v-if="!row.archived"
            type="button"
            class="archive-trigger"
            :aria-label="`归档 ${row.label}`"
            @click="openArchive(row.address)"
          >
            <Archive :size="16" /> 归档
          </button>
        </div>
      </article>
    </div>

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
  gap: 1rem;
  padding-block: 0.8rem 1.2rem;
  border-bottom: 1px solid var(--hairline);
}
.address-ledger > header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.address-ledger header p {
  margin: 0 0 0.25rem;
  color: var(--text-muted);
  font-size: 0.72rem;
}
.address-ledger h2 {
  margin: 0;
  font-size: 1.2rem;
  letter-spacing: -0.025em;
}
.address-create {
  display: grid;
  grid-template-columns: minmax(160px, 0.55fr) minmax(260px, 1fr) auto;
  align-items: end;
  gap: 0.8rem;
  padding: 1rem 0;
  border-block: 1px solid var(--hairline);
}
.address-table {
  display: grid;
}
.address-table article {
  display: grid;
  grid-template-columns: minmax(180px, 0.8fr) minmax(180px, 0.7fr) minmax(260px, 1.2fr) auto;
  align-items: center;
  gap: 1rem;
  min-height: 86px;
  border-top: 1px solid var(--hairline);
}
.address-table article:first-child {
  border-top: 0;
}
.address-table article[data-archived] {
  opacity: 0.52;
}
.address-asset,
.address-identifier,
.address-state {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-width: 0;
}
.address-asset > span {
  display: grid;
  width: 38px;
  height: 38px;
  border-radius: 11px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-weight: 720;
  place-items: center;
}
.address-asset div,
.address-value {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}
small {
  color: var(--text-muted);
  font-size: 0.7rem;
}
.address-identifier code {
  overflow: hidden;
  color: var(--text-muted);
  font: 0.72rem var(--font-mono);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.address-identifier button,
.address-state button {
  display: inline-flex;
  min-width: 34px;
  min-height: 34px;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}
.address-state {
  justify-content: flex-end;
  font-size: 0.7rem;
  white-space: nowrap;
}
.address-state [data-tone='success'] {
  color: var(--success);
}
.address-state [data-tone='danger'] {
  color: var(--danger);
}
.archive-trigger:hover {
  color: var(--danger);
}
.archive-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.2rem;
  padding: 1rem;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--danger) 7%, var(--surface-raised));
}
.archive-confirm p,
.archive-confirm ul {
  margin: 0.25rem 0 0;
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}
.archive-confirm > div:last-child {
  display: flex;
  gap: 0.5rem;
}
.address-error {
  margin: 0;
  color: var(--danger);
  font-size: 0.78rem;
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
@media (max-width: 980px) {
  .address-table article {
    grid-template-columns: minmax(180px, 1fr) minmax(180px, 1fr);
    padding-block: 0.75rem;
  }
  .address-state {
    justify-content: flex-start;
  }
}
@media (max-width: 680px) {
  .address-create {
    grid-template-columns: 1fr;
  }
  .address-table article {
    grid-template-columns: 1fr;
    gap: 0.55rem;
    padding-block: 1rem;
  }
  .address-value {
    grid-template-columns: auto 1fr;
    align-items: baseline;
    gap: 0.5rem;
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
@media (prefers-reduced-motion: reduce) {
  .ledger-reveal-enter-active,
  .ledger-reveal-leave-active {
    transition: opacity 120ms linear;
  }
  .ledger-reveal-enter-from,
  .ledger-reveal-leave-to {
    transform: none;
  }
}
</style>
