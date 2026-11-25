<script setup lang="ts">
import { addressLabel, wt, wl } from '@/i18n/walletText'
import {
  PhArchive as Archive,
  PhCaretDown as CaretDown,
  PhPlus as Plus,
  PhX as Close,
  PhWallet as Wallet,
} from '@phosphor-icons/vue'
import { computed, nextTick, ref, watch } from 'vue'

import { smoothDetails as vSmoothDetails } from '@/directives/smoothDetails'
import { useWalletPagination } from '@/composables/useWalletPagination'
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
import WalletCopyButton from './WalletCopyButton.vue'
import WalletPagination from './WalletPagination.vue'

const props = defineProps<{ initialAddress?: string }>()

const wallet = useWalletStore()
const dashboard = useDashboardStore()
const creating = ref(false)
const createBusy = ref(false)
const ledger = ref<HTMLElement>()
const createdAddress = ref('')
const archiveBusy = ref(false)
const archiveChecking = ref(false)
const archiveInputOwners = ref<Record<string, string>>({})
const type = ref('0')
const error = ref('')
const archiveAddress = ref('')

const typeOptions = ['0', '1', '2'].map((value) => ({
  value,
  ...assetIdentityForType(value),
}))

const rows = computed(() =>
  wallet.addresses.map((record, index) => {
    const balance = dashboard.current.addresses.find((item) => item.address === record.address)
    const metadata = wallet.metadata?.addresses[record.address]
    const asset = assetIdentityForType(record.type)
    return {
      address: record.address,
      ...asset,
      label: addressLabel(metadata?.label, index + 1) || wt('w357', [asset.symbol]),
      archived: metadata?.archived ?? false,
      registration: metadata?.registration ?? 'active',
      status: metadata?.archived
        ? wt('w371')
        : {
            active: wt('w75'),
            failed: wt('addressRegistrationFailed'),
            pending: wt('w373'),
          }[metadata?.registration ?? 'active'],
      registrationError: metadata?.error,
      utxo: balance?.balance ?? '0',
      txCer: balance?.txCerBalance ?? '0',
      total: addAmounts(balance?.balance ?? '0', balance?.txCerBalance ?? '0'),
    }
  }),
)

const activeCount = computed(() => rows.value.filter((item) => !item.archived).length)
const { page, pageCount, items: addressRows, goToIndex } = useWalletPagination(rows)
watch(
  () => rows.value.findIndex((row) => row.address === props.initialAddress),
  goToIndex,
  { immediate: true },
)
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

async function register(address: string): Promise<void> {
  const service = getWalletEntryService()
  if (!service) throw new Error(wt('w358'))
  await service.registerAddress(address, dashboard.current.organization?.id)
  await wallet.setAddressMetadata(address, { registration: 'active', error: undefined })
}

async function createAddress(): Promise<void> {
  if (wallet.lifecycle !== 'unlocked' || createBusy.value) return
  createBusy.value = true
  error.value = ''
  try {
    const address = await wallet.addAddress(Number(type.value))
    try {
      await register(address.address)
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : wt('w359')
      await wallet.setAddressMetadata(address.address, { registration: 'failed', error: message })
    } finally {
      createdAddress.value = address.address
      creating.value = false
      goToIndex(rows.value.findIndex((row) => row.address === address.address))
      await nextTick()
      ledger.value?.querySelector<HTMLElement>(`#receive-address-${address.address}`)?.focus()
    }
    if (wallet.metadata?.addresses[address.address]?.registration === 'active')
      await dashboard.sync(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : wt('w360')
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
    const message = cause instanceof Error ? cause.message : wt('w359')
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
      if (!service) throw new Error(wt('w361'))
      await service.unbindAddress(row.address, dashboard.current.organization?.id)
    }
    await wallet.setAddressMetadata(row.address, { archived: true })
    archiveAddress.value = ''
    await dashboard.sync(true)
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : wt('w362')
  } finally {
    archiveBusy.value = false
  }
}
</script>

<template>
  <section ref="ledger" class="address-ledger" :aria-label="wt('refinement0')">
    <Teleport v-if="$slots['header-action']" defer to="#intro-addresses">
      <slot name="header-action" />
    </Teleport>
    <header class="ledger-heading">
      <h2>{{ wt('refinement1') }}</h2>
      <button
        type="button"
        class="create-toggle"
        :aria-expanded="creating"
        :aria-controls="creating ? 'address-create' : undefined"
        :disabled="createBusy || wallet.lifecycle !== 'unlocked'"
        @click="creating = !creating"
      >
        <component :is="creating ? Close : Plus" :size="16" aria-hidden="true" />
        {{ creating ? wt('w108') : wt('w366') }}
      </button>
    </header>
    <Transition name="ledger-reveal">
      <form v-if="creating" id="address-create" class="address-create" @submit.prevent="createAddress">
        <fieldset :disabled="createBusy" class="asset-picker">
          <legend>{{ wt('w367') }} · {{ wt('transferArea') }}</legend>
          <div class="asset-options">
            <label v-for="option in typeOptions" :key="option.value">
              <input v-model="type" type="radio" name="new-address-type" :value="option.value" />
              <span>{{ option.symbol }}</span>
            </label>
          </div>
        </fieldset>
        <AppButton type="submit" :loading="createBusy" :disabled="wallet.lifecycle !== 'unlocked'">
          {{ wt('w369') }}
        </AppButton>
      </form>
    </Transition>
    <p v-if="!rows.length" class="ledger-empty">{{ wt('refinement3') }}</p>
    <div v-else class="address-table">
      <details
        v-for="row in addressRows"
        :key="row.address"
        v-smooth-details
        class="ledger-record"
        :open="row.address === initialAddress || row.address === createdAddress"
      >
        <summary
          class="ledger-record-summary"
          :id="`receive-address-${row.address}`"
          :data-initial-address-row="row.address === initialAddress ? '' : undefined"
        >
          <span class="wallet-record-icon" aria-hidden="true">
            <Wallet :size="18" weight="duotone" />
          </span>
          <span class="ledger-record-identity">
            <span class="ledger-record-title">
              <strong>{{ row.label }}</strong>
              <span>{{ row.symbol }}</span>
            </span>
            <code class="record-address">{{ row.address }}</code>
            <code class="record-address-short">{{ row.address.length > 20
              ? row.address.slice(0, 9) + '…' + row.address.slice(-7) : row.address }}</code>
          </span>
          <span
            class="address-status"
            :data-tone="row.archived ? 'muted' : row.registration"
          >
            {{ row.status }}
          </span>
          <CaretDown class="ledger-record-caret" :size="14" aria-hidden="true" />
        </summary>
        <div class="ledger-record-details">
          <div class="ledger-record-body">
            <div class="address-identity">
              <div class="address-identifier">
                <span class="field-label">{{ wl(row.name) }} · {{ wt('transferArea') }}</span>
                <code>{{ row.address }}</code>
              </div>
              <div class="address-actions">
                <WalletCopyButton :value="row.address" :label="row.label" />
                <button
                  v-if="!row.archived && row.registration === 'failed'"
                  type="button"
                  class="registration-retry"
                  @click="retryRegistration(row.address)"
                >
                  {{ wt('w372') }}
                </button>
                <button
                  v-if="!row.archived"
                  type="button"
                  class="archive-trigger"
                  :disabled="archiveBusy || archiveChecking"
                  :aria-label="wt('w374', [row.label])"
                  @click="openArchive(row.address)"
                >
                  <Archive :size="15" aria-hidden="true" />{{ wt('w375') }}
                </button>
              </div>
            </div>
            <dl class="address-balances">
              <div>
                <dt>{{ wt('refinement4') }}</dt>
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
          </div>
          <p v-if="row.registrationError" class="registration-error">
            {{ wl(row.registrationError) }}
          </p>
          <Transition name="ledger-reveal">
            <div
              v-if="archiveAddress === row.address"
              class="archive-confirm"
              role="group"
              :aria-label="wt('w375')"
            >
              <div>
                <strong>{{ wt('w375') }} {{ row.label }}？</strong>
                <p>{{ wt('w376') }}</p>
                <ul v-if="archiveDecision?.reasons.length">
                  <li v-for="reason in archiveDecision.reasons" :key="reason">{{ reason }}</li>
                </ul>
              </div>
              <div>
                <AppButton variant="ghost" :disabled="archiveBusy" @click="archiveAddress = ''">{{
                  wt('w108')
                }}</AppButton>
                <AppButton
                  variant="danger"
                  :disabled="archiveChecking || !archiveDecision?.allowed"
                  :loading="archiveBusy || archiveChecking"
                  @click="confirmArchive"
                >
                  {{ wt('w377') }}
                </AppButton>
              </div>
            </div>
          </Transition>
        </div>
      </details>
      <WalletPagination v-model="page" :page-count="pageCount" :label="wt('refinement1')" />
    </div>

    <p v-if="error" class="address-error" role="alert">{{ wl(error) }}</p>
  </section>
</template>

<style scoped>
.address-ledger {
  display: grid;
  min-width: 0;
}
.ledger-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  padding-block: 1rem 0.65rem;
}
.ledger-heading h2 {
  margin: 0;
  font-size: 0.95rem;
  font-weight: 650;
}
.create-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  min-height: 36px;
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--hairline);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 0.8rem;
  cursor: pointer;
}
.create-toggle:hover { background: var(--surface-hover); }
.create-toggle:focus-visible { outline: 2px solid var(--focus); }
.create-toggle:disabled { opacity: 0.6; cursor: default; }
.address-create {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.8rem 1.5rem;
  padding: 0.3rem 0 1rem;
}
.asset-picker {
  margin: 0;
  padding: 0;
  min-width: 0;
  max-width: 100%;
  border: 0;
}
.asset-picker legend {
  padding: 0;
  margin-bottom: 0.45rem;
  color: var(--text-muted);
  font-size: 0.75rem;
}
.asset-options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.asset-options label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  min-height: 40px;
  padding-inline: 0.7rem;
  border: 1px solid var(--hairline);
  border-radius: 8px;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.asset-options label:has(:checked) {
  background: var(--wallet-selection-fill, var(--surface-hover));
  border-color: var(--accent);
  color: var(--text);
}
.asset-options input { margin: 0; accent-color: var(--accent); }
.asset-options label:has(:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; }
.address-create > .app-button { min-height: 40px; }
.record-address-short { display: none; }
.address-table {
  border-top: 1px solid var(--hairline);
  display: grid;
}
.ledger-record + .ledger-record {
  border-top: 1px solid var(--hairline);
}
.ledger-record-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 12px;
  min-height: 62px;
  padding: 8px 10px;
  border-radius: 8px;
  list-style: none;
  cursor: pointer;
}
.ledger-record-summary::-webkit-details-marker {
  display: none;
}
.ledger-record-summary:hover {
  background: var(--surface-hover);
}
.ledger-record-summary:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: -2px;
}
.ledger-record-identity {
  display: grid;
  gap: 3px;
  min-width: 0;
  overflow-wrap: anywhere;
}
.ledger-record-identity strong {
  font-size: 0.85rem;
  font-weight: 600;
}
.ledger-record-title {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 0.5rem;
}
.ledger-record-title > span {
  color: var(--text-muted);
  font-size: 0.67rem;
}
.ledger-record-identity code {
  color: var(--text-muted);
  font: 0.7rem/1.5 var(--font-mono);
}
.address-status {
  color: var(--text-muted);
  font-size: 0.7rem;
  text-align: end;
}
.address-status[data-tone='failed'] {
  color: var(--danger);
}
.address-status[data-tone='pending'] { color: var(--accent); }
.ledger-record-caret {
  color: var(--text-muted);
  transition: transform 180ms var(--ease-standard);
}
.ledger-record[open] .ledger-record-caret {
  transform: rotate(180deg);
}
.ledger-record-details {
  display: grid;
  gap: 0.6rem;
  padding: 0.35rem 10px 0.85rem 54px;
}
.ledger-record-body {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(210px, 1fr);
  gap: 0.75rem 1.5rem;
  align-items: center;
}
.address-balances {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0.7rem 0;
  border-radius: 10px;
  background: var(--surface-hover);
}
.address-balances > div {
  min-width: 0;
  padding-inline: clamp(0.45rem, 1.25vw, 0.9rem);
}
.address-balances > div + div {
  border-inline-start: 1px solid var(--hairline);
}
.address-balances dt,
.field-label {
  color: var(--text-muted);
  font-size: 0.7rem;
}
.address-balances dd {
  margin: 0.3rem 0 0;
  font-size: 1.08rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.registration-error {
  color: var(--danger);
  font-size: 0.75rem;
  margin: 0;
}
small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.5;
}
.address-identifier {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
}
.address-identity {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
}
.address-identifier code {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text);
  font: 0.75rem/1.6 var(--font-mono);
}
.address-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  margin-inline-start: -0.45rem;
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
.address-actions .archive-trigger:hover,
.address-actions .registration-retry {
  color: var(--danger);
}
.archive-confirm {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
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
  padding-inline: 0;
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
  .archive-confirm {
    align-items: stretch;
    flex-direction: column;
  }
  .archive-confirm > div:last-child {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }
}
@container (max-width: 540px) {
  .ledger-record-body {
    grid-template-columns: minmax(0, 1fr);
  }
  .ledger-record-details {
    padding-inline-start: 10px;
  }
  .address-balances {
    gap: 0.5rem;
  }
  .address-balances dd {
    font-size: 1rem;
  }
}
@container (max-width: 440px) {
  .address-create > .app-button { width: 100%; }
  .record-address { display: none; }
  .record-address-short { display: inline; }
  .address-status { max-width: 5.5rem; }
}
@media (pointer: coarse) {
  .address-actions button,
  .create-toggle,
  .asset-options label,
  .address-create > .app-button,
  .registration-retry {
    min-height: 44px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .ledger-reveal-enter-active,
  .ledger-reveal-leave-active,
  .ledger-record-caret {
    transition: none;
  }
  .ledger-reveal-enter-from,
  .ledger-reveal-leave-to {
    transform: none;
  }
}
</style>
