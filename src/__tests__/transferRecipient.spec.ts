import { describe, expect, it } from 'vitest'

import { resolveRecipientSpendMetadata } from '@/transfer/recipient'

describe('recipient spend metadata', () => {
  it('uses authoritative address metadata and maps retail group to an empty group ID', () => {
    const address = 'ab'.repeat(20)
    expect(
      resolveRecipientSpendMetadata(address, {
        Addresstogroup: {
          [address]: {
            GroupID: '1',
            PublicKey: { CurveName: 'P256', X: '11', Y: '12' },
            Type: 0,
            SeedAnchor: [1, 2, 3],
            SeedChainStep: 9,
            DefaultSpendAlgorithm: 'ecdsa_p256',
          },
        },
      }),
    ).toEqual({
      address,
      groupID: '',
      publicKey: { CurveName: 'P256', X: 11n, Y: 12n },
      coinType: 0,
      seedAnchor: [1, 2, 3],
      seedChainStep: 9,
      defaultSpendAlgorithm: 'ecdsa_p256',
    })
  })

  it('fails closed for unknown addresses or incomplete seed metadata', () => {
    const address = 'cd'.repeat(20)
    expect(() => resolveRecipientSpendMetadata(address, { Addresstogroup: {} })).toThrow(
      'recipient is not registered',
    )
    expect(() =>
      resolveRecipientSpendMetadata(address, {
        Addresstogroup: {
          [address]: {
            GroupID: 'group-a',
            PublicKey: { CurveName: 'P256', X: '11', Y: '12' },
            Type: 0,
            SeedAnchor: [],
            SeedChainStep: 0,
            DefaultSpendAlgorithm: '',
          },
        },
      }),
    ).toThrow('recipient seed metadata is incomplete')
  })
})
