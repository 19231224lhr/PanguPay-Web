import { computed, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { GatewayClient } from '@/services/gatewayClient'
import { useWalletStore } from '@/stores/wallet'
import { buildDashboardSnapshot, shouldAnimateBalance } from '@/wallet/dashboard'
import {
  buildCredentialAuthorities,
  credentialGroupIDs,
  extractIssuanceRecords,
  isActiveCredentialAuditPending,
  isActiveCredentialFailure,
  mergeTXCerDeliveryEnvelopes,
  mergeTXCerIssuanceResponses,
  normalizeCredentialSummaries,
} from '@/wallet/credentials'
import {
  certifiedReceiveActivities,
  mergeWalletActivities,
  normalizeActivities,
  normalizeAddressState,
  normalizeOrganization,
  spendReadyReceiveActivities,
} from '@/wallet/gatewayDashboard'
import { IndexedDBWalletRepository } from '@/wallet/repository'
import type { OrganizationSummary, WalletActivity, WalletDashboardSnapshot } from '@/wallet/types'

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
  const groupInfoCache = new Map<string, unknown>()
  const certifierCache = new Map<string, unknown>()
  let syncGeneration = 0
  let syncing = false
  let detailsRequest: Promise<void> | undefined
  const certifiedActivities = shallowRef<WalletActivity[]>([])
  const receiveNotices = shallowRef<WalletActivity[]>([])

  const current = computed(
    () =>
      snapshot.value ??
      emptySnapshot(
        wallet.accountId,
        wallet.activeAddresses.map((address) => ({ address: address.address, type: address.type })),
      ),
  )

  function observeCertifiedBlock(response: unknown, block: { timestamp: number }): void {
    if (wallet.lifecycle !== 'unlocked') return
    const addresses = new Set(wallet.addresses.map(item => item.address.toLowerCase()))
    const incoming = certifiedReceiveActivities(response, block.timestamp, addresses)
    if (!incoming.length) return
    certifiedActivities.value = mergeWalletActivities(certifiedActivities.value, incoming)
    const previous = snapshot.value
    if (previous?.accountId !== wallet.accountId) return
    const next = { ...previous, activities: mergeWalletActivities(previous.activities, incoming) }
    snapshot.value = next
    void repository.saveDashboard(next).catch(() => undefined)
  }

  async function optional<T>(request: Promise<T>): Promise<T | undefined> {
    try {
      return await request
    } catch {
      return undefined
    }
  }

  async function cachedOptional(
    cache: Map<string, unknown>,
    key: string,
    request: () => Promise<unknown>,
  ): Promise<unknown | undefined> {
    if (cache.has(key)) return cache.get(key)
    const value = await optional(request())
    if (value !== undefined) cache.set(key, value)
    return value
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

  async function refreshDetails(
    generation: number,
    accountId: string,
    addressRecords: Array<{ address: string; type: string }>,
    addressResponse: unknown,
    statusResponse: unknown,
    organization: OrganizationSummary,
  ): Promise<void> {
    const [updateResponse, issuanceResponse, deliveryResponse] = await Promise.all([
      optional(client.accountUpdates(organization.id, accountId)),
      optional(client.issuanceRecords(organization.id, accountId)),
      optional(client.pollCrossOrganizationTXCers(organization.id, accountId)),
    ])
    if (generation !== syncGeneration) return

    const receivedTXCers = mergeTXCerDeliveryEnvelopes(
      snapshot.value?.receivedTXCers ?? [],
      deliveryResponse,
      addressRecords.map((item) => item.address),
    )
    const records = extractIssuanceRecords(
      mergeTXCerIssuanceResponses(issuanceResponse, { txcers: receivedTXCers }),
    )
    const groupIDs = credentialGroupIDs(records)
    const groupResponses = Object.fromEntries(
      await Promise.all(
        groupIDs.map(async (groupID) => [
          groupID,
          await cachedOptional(groupInfoCache, groupID, () => client.groupInfo(groupID)),
        ]),
      ),
    )
    const certifierResponses = Object.fromEntries(
      await Promise.all(
        groupIDs.map(async (groupID) => [
          groupID,
          await cachedOptional(certifierCache, groupID, () => client.certifiers(groupID)),
        ]),
      ),
    )
    if (
      generation !== syncGeneration ||
      wallet.lifecycle !== 'unlocked' ||
      wallet.accountId !== accountId
    )
      return

    const credentials = normalizeCredentialSummaries(
      records,
      statusResponse,
      buildCredentialAuthorities(records, groupResponses, certifierResponses),
    )
    const credentialStatuses = new Map(
      credentials.map((item) => [item.txCerId, item.fastEvidenceStatus]),
    )
    const next = buildDashboardSnapshot({
      accountId,
      displayName: wallet.profile.displayName,
      addresses: normalizeAddressState(
        addressRecords,
        addressResponse,
        statusResponse,
        credentialStatuses,
      ),
      updatedAt: Date.now(),
    })
    next.organization = organization
    next.receivedTXCers = receivedTXCers
    next.credentials = credentials
    next.security.pendingAudits = credentials.filter(isActiveCredentialAuditPending).length
    next.security.isolatedCount = credentials.filter(isActiveCredentialFailure).length
    next.security.credentialStatus = next.security.isolatedCount > 0 ? 'warning' : 'normal'
    const addresses = new Set(wallet.addresses.map((item) => item.address.toLowerCase()))
    const previousActivities = snapshot.value?.activities ?? []
    next.activities = mergeWalletActivities(
      previousActivities,
      spendReadyReceiveActivities(records, credentials, statusResponse, {
        id: accountId,
        organizationId: organization.id,
        addresses,
        activeAddresses: new Set(addressRecords.map((item) => item.address.toLowerCase())),
      }),
      normalizeActivities(updateResponse, addresses),
      certifiedActivities.value,
    )

    if (generation !== syncGeneration) return
    const previousIDs = new Set(previousActivities.map((item) => item.id))
    const arrivals = next.activities.filter(
      (item) => item.status === 'spend-ready' && !previousIDs.has(item.id),
    )
    if (arrivals.length) receiveNotices.value = mergeWalletActivities(receiveNotices.value, arrivals)
    const shouldAnimate = shouldAnimateBalance(snapshot.value, next, false)
    snapshot.value = next
    await repository.saveDashboard(next)
    if (generation === syncGeneration && shouldAnimate) revision.value += 1
  }

  async function sync(manual = false, background = false): Promise<void> {
    if (wallet.lifecycle !== 'unlocked') return
    if (syncing) {
      if (manual) loading.value = true
      return
    }
    const generation = ++syncGeneration
    syncing = true
    loading.value = !background
    if (!background) error.value = ''
    try {
      const accountId = wallet.accountId
      const previous = snapshot.value
      const knownOrganizationID = previous?.organization?.id
      const addressRecords = wallet.activeAddresses.map((address) => ({
        address: address.address,
        type: address.type,
      }))
      const [addressResponse, groupResponse, knownStatusResponse] = await Promise.all([
        client.queryAddresses(addressRecords.map((address) => address.address)),
        client.queryAddressGroups(addressRecords.map((address) => address.address)),
        knownOrganizationID
          ? client
              .txCerStatuses(knownOrganizationID, accountId)
              .then((value) => ({ value }))
              .catch((cause: unknown) => ({ cause }))
          : Promise.resolve({ value: undefined }),
      ])
      if (generation !== syncGeneration) return

      const organization = normalizeOrganization(groupResponse)
      let statusResponse: unknown
      if (organization) {
        if (knownOrganizationID === organization.id) {
          if ('cause' in knownStatusResponse) throw knownStatusResponse.cause
          statusResponse = knownStatusResponse.value
        } else statusResponse = await client.txCerStatuses(organization.id, accountId)
      }
      if (generation !== syncGeneration) return

      const canPreserveDetails = previous?.organization?.id === organization?.id
      const credentialStatuses = new Map(
        previous?.credentials.map((item) => [item.txCerId, item.fastEvidenceStatus]) ?? [],
      )
      const next = buildDashboardSnapshot({
        accountId,
        displayName: wallet.profile.displayName,
        addresses: normalizeAddressState(
          addressRecords,
          addressResponse,
          statusResponse,
          credentialStatuses,
        ),
        updatedAt: Date.now(),
      })
      next.organization = organization
      if (canPreserveDetails && previous) {
        next.receivedTXCers = previous.receivedTXCers
        next.credentials = previous.credentials
        next.security.pendingAudits = previous.security.pendingAudits
        next.security.isolatedCount = previous.security.isolatedCount
        next.security.credentialStatus = previous.security.credentialStatus
      }
      next.activities = mergeWalletActivities(snapshot.value?.activities ?? [], certifiedActivities.value)
      const shouldAnimate = shouldAnimateBalance(previous, next, manual)
      snapshot.value = next
      await repository.saveDashboard(next)
      offline.value = false
      error.value = ''
      if (shouldAnimate) revision.value += 1

      if (organization) {
        const request = refreshDetails(
          generation,
          accountId,
          addressRecords,
          addressResponse,
          statusResponse,
          organization,
        ).catch(() => undefined)
        detailsRequest = request
        void request.finally(() => {
          if (detailsRequest === request) detailsRequest = undefined
        })
      }
    } catch (cause) {
      offline.value = true
      error.value = cause instanceof Error ? cause.message : '账户同步失败'
      if (!snapshot.value) await loadCache()
    } finally {
      if (generation === syncGeneration) {
        syncing = false
        loading.value = false
      }
    }
  }

  function pollReceipts(): void {
    if (current.value.organization && !detailsRequest) void sync(false, true)
  }

  function dismissReceiveNotices(): void {
    receiveNotices.value = []
  }

  function reset(): void {
    syncGeneration += 1
    snapshot.value = undefined
    certifiedActivities.value = []
    receiveNotices.value = []
    detailsRequest = undefined
    syncing = false
    loading.value = false
    offline.value = false
    error.value = ''
    groupInfoCache.clear()
    certifierCache.clear()
  }

  return {
    snapshot,
    current,
    loading,
    offline,
    error,
    revision,
    receiveNotices,
    loadCache,
    sync,
    reset,
    observeCertifiedBlock,
    pollReceipts,
    dismissReceiveNotices,
  }
})
