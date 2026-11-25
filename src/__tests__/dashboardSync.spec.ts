import { mount } from '@vue/test-utils'
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
  gqncStatus: vi.fn<() => Promise<unknown>>(),
  gqncCertifiedBlock: vi.fn<(height: number) => Promise<unknown>>(),
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
    gqncStatus = gateway.gqncStatus
    gqncCertifiedBlock = gateway.gqncCertifiedBlock
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
import { createWalletNetwork } from '@/composables/useWalletNetwork'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'
import { buildDashboardSnapshot } from '@/wallet/dashboard'
import * as credentials from '@/wallet/credentials'
import { wt } from '@/i18n/walletText'

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

  it('restores settled receipts from Assign account updates after their blocks leave the recent feed', async () => {
    const ordinaryID = 'a'.repeat(64)
    const quickID = 'b'.repeat(64)
    const changeID = 'c'.repeat(64)
    const liveID = 'e'.repeat(64)
    const output = { ToAddress: 'address-1', ToValue: '1.25', Type: 0 }
    const ordinary = {
      TXID: ordinaryID,
      TXType: 8,
      TXInputsNormal: [{ FromAddress: 'external-sender' }],
      TXOutputs: [output],
    }
    const quick = {
      TXID: quickID,
      TXType: 1,
      TXInputsCertificate: [{ ToAddress: 'external-sender' }],
      TXOutputs: [output, { ...output, ToValue: '0.5' }],
    }
    const change = {
      TXID: changeID,
      TXType: 1,
      TXInputsCertificate: [{ ToAddress: 'address-1' }],
      TXOutputs: [output],
    }
    gateway.txCerStatuses.mockResolvedValue({ statuses: [] })
    gateway.accountUpdates.mockResolvedValue({
      updates: [
        {
          IsNoWalletChange: false,
          WalletChangeData: {
            In: {
              'address-1': [ordinary, quick, quick, change].map((UTXO) => ({
                UTXOData: { UTXO, Time: 900 },
              })),
            },
          },
          Timestamp: 1_000,
        },
        { IsNoWalletChange: true, Timestamp: 1_001 },
      ],
    })
    gateway.issuanceRecords.mockResolvedValue({ records: [] })
    gateway.pollCrossOrganizationTXCers.mockResolvedValue([])

    const dashboard = useDashboardStore()
    await dashboard.sync()
    await vi.waitFor(() => expect(dashboard.current.activities).toHaveLength(2))

    gateway.gqncStatus.mockResolvedValue({
      status: { protocolVersion: 'gqnc-master-v2', safetyStatus: 'NORMAL', certifiedHeight: 1 },
    })
    gateway.gqncCertifiedBlock.mockResolvedValue({
      envelope: {
        QC: { QCID: 'd'.repeat(64), Threshold: 3, Signers: ['1', '2', '3'] },
        Block: {
          Head: { BlockHeight: 1, Timestamp: 901 },
          Body: {
            Transactions: [
              { AggregateTX: { AllTransactions: [ordinary, { ...quick, TXID: liveID }, change] } },
            ],
          },
        },
      },
    })
    const network = createWalletNetwork(dashboard.observeCertifiedBlock)
    const activity = mount(WalletActivityView)
    try {
      await network.refreshChain()

      expect(activity.findAll('.activity-row')).toHaveLength(3)
      expect(activity.findAll('.activity-amount b').map((amount) => amount.text()).sort()).toEqual([
        '+1.25',
        '+1.75',
        '+1.75',
      ])
      expect(activity.findAll('.activity-status').map((status) => status.attributes('data-tone')))
        .toEqual(['success', 'success', 'success'])
      expect(activity.text()).toContain(ordinaryID)
      expect(activity.text()).toContain(quickID)
      expect(activity.text()).toContain(liveID)
    } finally {
      activity.unmount()
      network.dispose()
    }
  })

  it('notifies once as the incoming transaction becomes spend-ready, then updates the same activity to settled', async () => {
    const txID = '9'.repeat(64)
    const txCerId = 'a'.repeat(64)
    const userID = '25226118'
    const groupID = '10000000'
    const issuance = {
      RecordID: 'record-1',
      TXID: txID,
      TXCerID: txCerId,
      UserID: userID,
      ToAddress: 'address-1',
      TXCer: { ToAddress: 'address-1', ToGuarGroupID: groupID, Value: '1.1' },
      Ack: { userID, groupID, status: 'RegisteredActive', registeredAt: 8 },
      FastEvidence: { Reservation: { SoftKeys: ['address_spend:external-sender'] } },
    }
    gateway.txCerStatuses.mockResolvedValue({
      statuses: [{ txCerID: txCerId, userID, address: 'address-1', sourceTXID: txID, status: 'Active', value: '1.1' }],
    })
    gateway.accountUpdates.mockResolvedValue([])
    gateway.issuanceRecords.mockResolvedValue({ records: [] })
    gateway.pollCrossOrganizationTXCers.mockResolvedValue({
      txcers: [{ ToAddress: 'address-1', TXCer: { TXCerID: txCerId, ...issuance.TXCer }, IssuanceRecord: issuance }],
    })
    const verification = vi.spyOn(credentials, 'normalizeCredentialSummaries').mockReturnValue([
      {
        txCerId,
        recordId: issuance.RecordID,
        lifecycle: 'Active',
        amount: '1.1',
        toAddress: 'address-1',
        fastEvidenceStatus: 'Verified',
        cfaaAuditStatus: 'Pending',
        error: '',
        hasFastEvidence: true,
        hasAssignAck: true,
        hasLiabilityReceipt: true,
        hasCFAAProof: false,
        rootIds: [],
        exposureShares: [],
      },
    ])
    const dashboard = useDashboardStore()
    const activity = mount(WalletActivityView)
    try {
      await dashboard.sync()
      await vi.waitFor(() => expect(dashboard.current.activities).toHaveLength(1))
      expect(activity.find('.activity-status').text()).toBe(wt('activitySpendReady'))
      expect(dashboard.receiveNotices).toMatchObject([{ id: txID, amount: '1.1' }])

      dashboard.dismissReceiveNotices()
      await dashboard.sync()
      await vi.waitFor(() => expect(verification).toHaveBeenCalledTimes(2))
      expect(dashboard.receiveNotices).toEqual([])

      dashboard.observeCertifiedBlock({
        envelope: {
          QC: { QCID: 'b'.repeat(64), Threshold: 3, Signers: ['1', '2', '3'] },
          Block: { Body: { Transactions: [{ AggregateTX: { AllTransactions: [{
            TXID: txID,
            TXInputsNormal: [{ FromAddress: 'external-sender' }],
            TXOutputs: [{ ToAddress: 'address-1', ToValue: '1.1', Type: 0 }],
          }] } }] } },
        },
      }, { timestamp: 10 })
      await flushPromises()
      expect(activity.findAll('.activity-row')).toHaveLength(1)
      expect(activity.find('.activity-status').text()).toBe(wt('activitySettled'))
      expect(dashboard.receiveNotices).toEqual([])
    } finally {
      activity.unmount()
      verification.mockRestore()
    }
  })

  it('polls for incoming receipts without showing a manual refresh in progress', async () => {
    gateway.txCerStatuses.mockResolvedValue([])
    gateway.accountUpdates.mockResolvedValue([])
    gateway.issuanceRecords.mockResolvedValue([])
    gateway.pollCrossOrganizationTXCers.mockResolvedValue([])
    const dashboard = useDashboardStore()
    const firstSave = dashboard.sync()
    await firstSave
    await vi.waitFor(() => expect(repository.saveDashboard).toHaveBeenCalledTimes(2))

    const pending = deferred<unknown>()
    gateway.queryAddresses.mockReturnValueOnce(pending.promise)
    dashboard.pollReceipts()
    dashboard.pollReceipts()
    expect(gateway.queryAddresses).toHaveBeenCalledTimes(2)
    expect(dashboard.loading).toBe(false)

    pending.resolve({ AddressData: {} })
    await vi.waitFor(() => expect(repository.saveDashboard).toHaveBeenCalledTimes(4))
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
