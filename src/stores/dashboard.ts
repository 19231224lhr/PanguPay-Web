import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { GatewayClient } from '@/services/gatewayClient'
import { useWalletStore } from '@/stores/wallet'
import { buildDashboardSnapshot, shouldAnimateBalance } from '@/wallet/dashboard'
import {
  buildCredentialAuthorities,
  credentialGroupIDs,
  extractIssuanceRecords,
  normalizeCredentialSummaries,
} from '@/wallet/credentials'
import {
  normalizeActivities,
  normalizeAddressState,
  normalizeOrganization,
} from '@/wallet/gatewayDashboard'
import { IndexedDBWalletRepository } from '@/wallet/repository'
import type { WalletDashboardSnapshot } from '@/wallet/types'

function emptySnapshot(accountId: string, addresses: Array<{ address: string; type: string }>) {
  return buildDashboardSnapshot({
    accountId,
    displayName: accountId ? `${accountId.slice(0, 4)} ${accountId.slice(4)}` : 'PanguPay',
    addresses: addresses.map((address) => ({ ...address, utxos: [], txCers: [] })),
    updatedAt: 0,
  })
}

export const useDashboardStore = defineStore('dashboard', () => {
  const wallet = useWalletStore()
  const snapshot = shallowRef<WalletDashboardSnapshot>()
  const loading = shallowRef(false)
  const offline = shallowRef(false)
  const error = shallowRef('')
  const revision = shallowRef(0)
  const repository = new IndexedDBWalletRepository()
  const client = new GatewayClient()

  const current = computed(
    () =>
      snapshot.value ??
      emptySnapshot(
        wallet.accountId,
        wallet.addresses.map((address) => ({ address: address.address, type: address.type })),
      ),
  )

  async function optional<T>(request: Promise<T>): Promise<T | undefined> {
    try {
      return await request
    } catch {
      return undefined
    }
  }

  async function loadCache(): Promise<void> {
    try {
      const cached = await repository.loadDashboard()
      if (cached?.accountId === wallet.accountId) {
        snapshot.value = { ...cached, source: 'cache' }
        offline.value = true
      }
    } catch {
      // A damaged public cache is disposable; the encrypted keystore is not.
    }
  }

  async function sync(manual = false): Promise<void> {
    if (loading.value || wallet.lifecycle !== 'unlocked') return
    loading.value = true
    error.value = ''
    try {
      const addressRecords = wallet.addresses.map((address) => ({
        address: address.address,
        type: address.type,
      }))
      await client.health()
      const [addressResponse, groupResponse] = await Promise.all([
        client.queryAddresses(addressRecords.map((address) => address.address)),
        client.queryAddressGroups(addressRecords.map((address) => address.address)),
      ])
      const organization = normalizeOrganization(groupResponse)
      const [statusResponse, updateResponse, issuanceResponse] = organization
        ? await Promise.all([
            optional(client.txCerStatuses(organization.id, wallet.accountId)),
            optional(client.accountUpdates(organization.id, wallet.accountId)),
            optional(client.issuanceRecords(organization.id, wallet.accountId)),
          ])
        : [undefined, undefined, undefined]
      const records = extractIssuanceRecords(issuanceResponse)
      const groupIDs = credentialGroupIDs(records)
      const groupResponses = Object.fromEntries(
        await Promise.all(
          groupIDs.map(async (groupID) => [groupID, await optional(client.groupInfo(groupID))]),
        ),
      )
      const certifierResponses = Object.fromEntries(
        await Promise.all(
          groupIDs.map(async (groupID) => [groupID, await optional(client.certifiers(groupID))]),
        ),
      )
      const credentials = normalizeCredentialSummaries(
        records,
        statusResponse,
        buildCredentialAuthorities(records, groupResponses, certifierResponses),
      )
      const credentialStatuses = new Map(
        credentials.map((item) => [item.txCerId, item.fastEvidenceStatus]),
      )
      const next = buildDashboardSnapshot({
        accountId: wallet.accountId,
        displayName: `${wallet.accountId.slice(0, 4)} ${wallet.accountId.slice(4)}`,
        addresses: normalizeAddressState(
          addressRecords,
          addressResponse,
          statusResponse,
          credentialStatuses,
        ),
        updatedAt: Date.now(),
      })
      next.organization = organization
      next.credentials = credentials
      next.security.pendingAudits = credentials.filter((item) =>
        ['Pending', 'Unavailable'].includes(item.cfaaAuditStatus),
      ).length
      next.security.isolatedCount = credentials.filter(
        (item) => item.fastEvidenceStatus === 'Failed',
      ).length
      next.security.credentialStatus = next.security.isolatedCount > 0 ? 'warning' : 'normal'
      next.activities = normalizeActivities(updateResponse)
      const shouldAnimate = shouldAnimateBalance(snapshot.value, next, manual)
      snapshot.value = next
      await repository.saveDashboard(next)
      offline.value = false
      if (shouldAnimate) revision.value += 1
    } catch (cause) {
      offline.value = true
      error.value = cause instanceof Error ? cause.message : '账户同步失败'
      if (!snapshot.value) await loadCache()
    } finally {
      loading.value = false
    }
  }

  function reset(): void {
    snapshot.value = undefined
    offline.value = false
    error.value = ''
  }

  return { snapshot, current, loading, offline, error, revision, loadCache, sync, reset }
})
