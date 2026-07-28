import { describe, expect, it } from 'vitest'

import {
  extractIssuanceRecords,
  mergeTXCerDeliveryEnvelopes,
  mergeTXCerIssuanceResponses,
} from '@/wallet/credentials'

function delivery(id: string, address = 'pgc-recipient') {
  return {
    ToAddress: address,
    TXCer: {
      TXCerID: id,
      TXID: 'f'.repeat(64),
      ToAddress: address,
      FromGuarGroupID: 'group-source',
      ToGuarGroupID: 'group-target',
      Value: '2',
      ExposureShares: [],
    },
    IssuanceRecordID: `record-${id.slice(0, 4)}`,
    IssuanceStatus: 'Delivered',
    IssuanceRecord: {
      RecordID: `record-${id.slice(0, 4)}`,
      UserID: 'user-1',
      ToAddress: address,
      TXCerID: id,
      GuarGroupID: 'group-source',
      FastEvidence: { TXCerID: id },
    },
    LiabilityReceipt: { ReceiptID: `receipt-${id.slice(0, 4)}` },
  }
}

describe('cross-organization TXCer delivery intake', () => {
  it('keeps deliveries for wallet addresses, deduplicates them, and rejects another wallet', () => {
    const id = 'a'.repeat(64)
    const accepted = delivery(id)
    const result = mergeTXCerDeliveryEnvelopes(
      [accepted],
      { txcers: [accepted, delivery('b'.repeat(64), 'someone-else')] },
      ['pgc-recipient'],
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ ToAddress: 'pgc-recipient', TXCer: { TXCerID: id } })
  })

  it('normalizes the authoritative nested issuance record and delivery evidence', () => {
    const id = 'c'.repeat(64)
    const merged = mergeTXCerIssuanceResponses({ records: [] }, { txcers: [delivery(id)] })
    const records = extractIssuanceRecords(merged)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      RecordID: 'record-cccc',
      TXCerID: id,
      GuarGroupID: 'group-source',
      TXCer: { TXCerID: id },
      LiabilityReceipt: { ReceiptID: 'receipt-cccc' },
    })
  })
})
