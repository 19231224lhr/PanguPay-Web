import { describe, expect, it } from 'vitest'
import {
  certifiedReceiveActivities,
  mergeWalletActivities,
  normalizeActivities,
  spendReadyReceiveActivities,
} from '@/wallet/gatewayDashboard'
import type { WalletCredentialSummary } from '@/wallet/types'

describe('certified receive activity', () => {
  const owner = 'a'.repeat(40)
  const id = 'b'.repeat(64)
  const addresses = new Set([owner])
  const transaction = {
    TXID: id,
    TXInputsNormal: [{ FromAddress: 'c'.repeat(40) }],
    TXOutputs: [
      { ToAddress: owner, ToValue: '1.1', Type: 0 },
      { ToAddress: owner, ToValue: '0.2', Type: 0 },
      { ToAddress: owner, ToValue: '10', IsPayForGas: true },
    ],
  }
  const block = (tx: unknown, signers = ['1', '2', '3']) => ({
    envelope: {
      QC: { QCID: 'c'.repeat(64), Threshold: 3, Signers: signers },
      Block: { Body: { Transactions: [{ AggregateTX: { AllTransactions: [tx] } }] } },
    },
  })

  it('records each certified transfer once, aggregating the receiving outputs', () => {
    const rows = certifiedReceiveActivities(block(transaction), 10, addresses)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      id, amount: '1.3', direction: 'in', status: 'settled', timestamp: Date.UTC(2020, 0, 1) + 10_000,
    })
    expect(mergeWalletActivities(rows, rows)).toEqual(rows)
  })

  it('excludes uncertified data and change from normal or TXCer inputs', () => {
    expect(certifiedReceiveActivities(block(transaction, ['1', '1', '2']), 10, addresses)).toEqual([])
    expect(certifiedReceiveActivities(block({
      ...transaction, TXInputsNormal: [{ FromAddress: owner }],
    }), 10, addresses)).toEqual([])
    expect(certifiedReceiveActivities(block({
      ...transaction, TXInputsCertificate: [{ ToAddress: owner }],
    }), 10, addresses)).toEqual([])
  })

  const account = { id: 'recipient', organizationId: 'target', addresses, activeAddresses: addresses }
  const ts = Date.UTC(2020, 0, 1) + 6_000
  const txCerId = 'd'.repeat(64)
  const issuance = {
    TXID: id,
    TXCerID: txCerId,
    UserID: account.id,
    ToAddress: owner,
    OutputIndex: 0,
    TXCer: { TXID: id, TXCerID: txCerId, ToAddress: owner, ToGuarGroupID: 'target', Value: '1.1' },
    Ack: { userID: account.id, groupID: 'target', status: 'RegisteredActive', registeredAt: 6 },
    FastEvidence: { Reservation: { SoftKeys: ['address_spend:' + 'c'.repeat(40)] } },
  }
  const credential = {
    txCerId,
    lifecycle: 'Active',
    fastEvidenceStatus: 'Verified',
  } as const satisfies Partial<WalletCredentialSummary>
  const lifecycle = {
    txCerID: txCerId,
    userID: account.id,
    address: owner,
    sourceTXID: id,
    status: 'Active',
    value: '1.1',
  }

  it('upgrades the same receipt to settled and keeps its first receipt timestamp', () => {
    const rows = spendReadyReceiveActivities([issuance], [credential], { statuses: [lifecycle] }, account)
    expect(rows).toEqual([
      { id, title: '转入', amount: '1.1', coinType: 0, direction: 'in', status: 'spend-ready', timestamp: ts },
    ])
    const settled = certifiedReceiveActivities(block(transaction), 10, addresses)
    expect(mergeWalletActivities(rows, settled, rows)).toEqual([
      { ...settled[0], timestamp: ts },
    ])
  })

  it('does not replace spend-ready evidence with an older generic account update', () => {
    const rows = spendReadyReceiveActivities([issuance], [credential], { statuses: [lifecycle] }, account)
    expect(mergeWalletActivities(rows, [{ ...rows[0]!, status: 'synced' }])).toEqual(rows)
  })

  it('withholds an early receipt for an archived destination', () => {
    expect(spendReadyReceiveActivities([issuance], [credential], { statuses: [lifecycle] }, {
      ...account,
      activeAddresses: new Set(),
    })).toEqual([])
  })

  it.each([
    ['unverified evidence', issuance, { ...credential, fastEvidenceStatus: 'Pending' as const }, lifecycle],
    ['wallet change', { ...issuance, FastEvidence: { Reservation: { SoftKeys: ['address_spend:' + owner] } } }, credential, lifecycle],
    ['missing input ownership', { ...issuance, FastEvidence: { Reservation: { SoftKeys: [] } } }, credential, lifecycle],
    ['invalid Assign lifecycle', issuance, credential, { ...lifecycle, status: 'Invalid' }],
    ['inconsistent Assign amount', issuance, credential, { ...lifecycle, value: '2' }],
    ['inconsistent Assign account', issuance, credential, { ...lifecycle, userID: 'other' }],
    ['wrong signed acknowledgement', { ...issuance, Ack: { ...issuance.Ack, userID: 'other' } }, credential, lifecycle],
  ])('withholds early receipt for %s', (_reason, record, trusted, status) => {
    expect(spendReadyReceiveActivities([record], [trusted], { statuses: [status] }, account)).toEqual([])
  })

  it('restores settlement after the recipient spent the certificate before finality', () => {
    const updates = { updates: [{ UsedTXCerChangeData: [{ UTXO: { UTXO: transaction, Time: 10 } }] }] }
    expect(normalizeActivities(updates, addresses)).toEqual(
      certifiedReceiveActivities(block(transaction), 10, addresses),
    )
  })
})
