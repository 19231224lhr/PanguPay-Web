import { describe, expect, it } from 'vitest'

import { normalizeAddressState, normalizeOrganization } from '@/wallet/gatewayDashboard'

describe('dashboard organization normalization', () => {
  it('does not present the retail routing group as a guarantor organization', () => {
    expect(
      normalizeOrganization({
        Addresstogroup: { abc: { GroupID: '1', GroupName: 'nogroup' } },
      }),
    ).toBeUndefined()
  })

  it('keeps an actual guarantor membership', () => {
    expect(
      normalizeOrganization({ Addresstogroup: { abc: { GroupID: 'group-7' } } }),
    ).toMatchObject({ id: 'group-7' })
  })
})

describe('dashboard spendable UTXO normalization', () => {
  const address = 'address-1'
  const sourceTXID = 'a'.repeat(64)
  const response = {
    AddressData: {
      [address]: {
        Value: '12',
        UTXO: {
          source: {
            UTXO: { TXID: sourceTXID },
            Value: '12',
            Position: { IndexZ: 0 },
          },
        },
      },
    },
  }

  it('excludes a source output that is awaiting TXCer exchange', () => {
    const addresses = normalizeAddressState([{ address, type: 'PGC' }], response, {
      statuses: [
        {
          txCerID: 'certificate-1',
          address,
          value: '12',
          status: 'AwaitingExchange',
          sourceTXID,
          sourcePosition: { InIndex: 0 },
        },
      ],
    })

    expect(addresses[0]?.utxos).toEqual([])
  })

  it('includes the output once the TXCer is converted to UTXO', () => {
    const addresses = normalizeAddressState([{ address, type: 'PGC' }], response, {
      statuses: [
        {
          txCerID: 'certificate-1',
          address,
          value: '12',
          status: 'ConvertedToUTXO',
          sourceTXID,
          sourcePosition: { InIndex: 0 },
        },
      ],
    })

    expect(addresses[0]?.utxos).toEqual([{ value: '12' }])
  })
})
