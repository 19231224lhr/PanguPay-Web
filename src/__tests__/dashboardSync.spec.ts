import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const gateway = vi.hoisted(() => ({
  health: vi.fn<() => Promise<unknown>>(),
  queryAddresses: vi.fn<(addresses: string[]) => Promise<unknown>>(),
  queryAddressGroups: vi.fn<(addresses: string[]) => Promise<unknown>>(),
  txCerStatuses: vi.fn<(groupID: string, accountID: string) => Promise<unknown>>(),
  accountUpdates: vi.fn<(groupID: string, accountID: string) => Promise<unknown>>(),
  issuanceRecords: vi.fn<(groupID: string, accountID: string) => Promise<unknown>>(),
  pollCrossOrganizationTXCers: vi.fn<(groupID: string, accountID: string) => Promise<unknown>>(),
  groupInfo: vi.fn<(groupID: string) => Promise<unknown>>(),
  certifiers: vi.fn<(groupID: string) => Promise<unknown>>(),
}))

const repository = vi.hoisted(() => ({
  loadDashboard: vi.fn<() => Promise<unknown>>(),
  saveDashboard: vi.fn<(snapshot: unknown) => Promise<void>>(),
  loadMetadata: vi.fn<(accountID: string) => Promise<unknown>>(),
  saveMetadata: vi.fn<(metadata: unknown) => Promise<void>>(),
}))

vi.mock('@/services/gatewayClient', () => ({
  GatewayClient: class {
    health = gateway.health
    queryAddresses = gateway.queryAddresses
    queryAddressGroups = gateway.queryAddressGroups
    txCerStatuses = gateway.txCerStatuses
    accountUpdates = gateway.accountUpdates
    issuanceRecords = gateway.issuanceRecords
    pollCrossOrganizationTXCers = gateway.pollCrossOrganizationTXCers
    groupInfo = gateway.groupInfo
    certifiers = gateway.certifiers
  },
}))

vi.mock('@/wallet/repository', () => ({
  IndexedDBWalletRepository: class {
    loadDashboard = repository.loadDashboard
    saveDashboard = repository.saveDashboard
    loadMetadata = repository.loadMetadata
    saveMetadata = repository.saveMetadata
  },
}))

import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import { buildDashboardSnapshot } from '@/wallet/dashboard'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe('dashboard fast synchronization', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    gateway.health.mockResolvedValue({ ok: true })
    gateway.queryAddresses.mockResolvedValue({
      AddressData: { 'address-1': { Value: '91', UTXO: {} } },
    })
    gateway.queryAddressGroups.mockResolvedValue({
      GroupID: '10000000',
      GroupName: 'Test Group',
      Role: 'member',
    })
    gateway.groupInfo.mockResolvedValue({ GroupID: '10000000' })
    gateway.certifiers.mockResolvedValue({ certifiers: [] })
    repository.loadDashboard.mockResolvedValue(undefined)
    repository.loadMetadata.mockResolvedValue(undefined)
    repository.saveDashboard.mockResolvedValue(undefined)
    repository.saveMetadata.mockResolvedValue(undefined)

    const wallet = useWalletStore()
    wallet.lifecycle = 'unlocked'
    wallet.unlockedRecord = {
      account_id: '25226118',
      account_private_scalar: '01'.repeat(32),
      addresses: [{ address: 'address-1', type: '0', root_seed: '02'.repeat(32) }],
    }
  })

  it('finishes the visible balance sync before credential detail requests finish', async () => {
    const updates = deferred<unknown>()
    const issuance = deferred<unknown>()
    const deliveries = deferred<unknown>()
    gateway.txCerStatuses.mockResolvedValue([])
    gateway.accountUpdates.mockReturnValue(updates.promise)
    gateway.issuanceRecords.mockReturnValue(issuance.promise)
    gateway.pollCrossOrganizationTXCers.mockReturnValue(deliveries.promise)

    const dashboard = useDashboardStore()
    const synchronization = dashboard.sync(true)
    await flushPromises()

    expect.soft(dashboard.loading).toBe(false)
    expect.soft(dashboard.current.assets[0]?.total).toBe('91')
    expect.soft(gateway.health).not.toHaveBeenCalled()

    updates.resolve([])
    issuance.resolve({ records: [] })
    deliveries.resolve([])
    await synchronization
    await flushPromises()
  })

  it('does not double count a TXCer that has converted into an address UTXO', async () => {
    const updates = deferred<unknown>()
    const issuance = deferred<unknown>()
    const deliveries = deferred<unknown>()
    gateway.queryAddresses.mockResolvedValue({
      AddressData: { 'address-1': { Value: '10', UTXO: {} } },
    })
    gateway.txCerStatuses.mockResolvedValue([
      {
        Address: 'address-1',
        TXCerID: 'txcer-1',
        Value: '10',
        Status: 'ConvertedToUTXO',
      },
    ])
    gateway.accountUpdates.mockReturnValue(updates.promise)
    gateway.issuanceRecords.mockReturnValue(issuance.promise)
    gateway.pollCrossOrganizationTXCers.mockReturnValue(deliveries.promise)

    const dashboard = useDashboardStore()
    const previous = buildDashboardSnapshot({
      accountId: '25226118',
      displayName: 'Test User',
      addresses: [
        {
          address: 'address-1',
          type: '0',
          utxos: [],
          txCers: [
            {
              id: 'txcer-1',
              value: '10',
              lifecycle: 'Active',
              fastEvidence: 'Verified',
            },
          ],
        },
      ],
      updatedAt: 1,
    })
    previous.organization = { id: '10000000', name: 'Test Group', role: 'member' }
    dashboard.snapshot = previous

    await dashboard.sync()

    expect(dashboard.current.assets[0]?.total).toBe('10')

    updates.resolve([])
    issuance.resolve({ records: [] })
    deliveries.resolve([])
    await flushPromises()
  })

  it('reuses successful authority responses during the same wallet session', async () => {
    gateway.txCerStatuses.mockResolvedValue([])
    gateway.accountUpdates.mockResolvedValue([])
    gateway.issuanceRecords.mockResolvedValue({
      records: [
        {
          RecordID: 'record-1',
          TXCerID: 'txcer-1',
          GuarGroupID: '10000000',
        },
      ],
    })
    gateway.pollCrossOrganizationTXCers.mockResolvedValue([])

    const dashboard = useDashboardStore()
    await dashboard.sync()
    await vi.waitFor(() => expect(gateway.groupInfo).toHaveBeenCalledTimes(1))

    await dashboard.sync()
    await vi.waitFor(() => expect(gateway.queryAddresses).toHaveBeenCalledTimes(2))
    await flushPromises()

    expect(gateway.groupInfo).toHaveBeenCalledTimes(1)
    expect(gateway.certifiers).toHaveBeenCalledTimes(1)
  })
})
