import { describe, expect, it } from 'vitest'

import {
  assertTransferDraft,
  buildRetailAggregate,
  buildRetailAggregateMaterial,
  canonicalizeUserNewTXSignatureMaterial,
  reserveInputs,
  selectSpendableInputs,
  signCanonicalMaterial,
  verifyCanonicalMaterial,
  type WalletSpendableSnapshot,
} from '@/transfer'

const snapshot: WalletSpendableSnapshot = {
  utxos: [
    { id: 'u-1', address: 'alice', coinType: 0, amount: '4', input: {} },
    { id: 'u-2', address: 'alice', coinType: 0, amount: '3', input: {} },
  ],
  txCers: [
    { id: 'c-1', address: 'alice', coinType: 0, amount: '5', lifecycle: 'Active', txCer: {} },
    {
      id: 'c-bad',
      address: 'alice',
      coinType: 0,
      amount: '9',
      lifecycle: 'Active',
      isolated: true,
      txCer: {},
    },
  ],
}

describe('transfer core', () => {
  it('selects Active TXCer first and fills the remainder with UTXO exactly', () => {
    const result = selectSpendableInputs(snapshot, { coinType: 0, amount: '6', preferTXCer: true })

    expect(result.txCerIDs).toEqual(['c-1'])
    expect(result.utxoIDs).toEqual(['u-1'])
    expect(result.total).toBe('9')
    expect(result.change).toBe('3')
  })

  it('rejects cross-chain drafts that use certificates or fractional PGC', () => {
    expect(() =>
      assertTransferDraft({
        mode: 'cross',
        membership: 'member',
        coinType: 0,
        amount: '1.5',
        recipient: '0x0000000000000000000000000000000000000001',
        usesTXCer: false,
      }),
    ).toThrow('whole PGC')

    expect(() =>
      assertTransferDraft({
        mode: 'cross',
        membership: 'member',
        coinType: 0,
        amount: '1',
        recipient: '0x0000000000000000000000000000000000000001',
        usesTXCer: true,
      }),
    ).toThrow('cannot use TXCer')
  })

  it('does not reserve an input twice', () => {
    const first = reserveInputs(new Set(), ['u-1', 'c-1'])
    expect(first).toEqual(new Set(['u-1', 'c-1']))
    expect(() => reserveInputs(first, ['u-1'])).toThrow('already reserved')
  })

  it('never spends inputs from an unselected source address', () => {
    const scoped: WalletSpendableSnapshot = {
      utxos: [
        { id: 'alice-u', address: 'alice', coinType: 0, amount: '1', input: {} },
        { id: 'bob-u', address: 'bob', coinType: 0, amount: '10', input: {} },
      ],
      txCers: [],
    }
    expect(() =>
      selectSpendableInputs(scoped, { address: 'alice', coinType: 0, amount: '2' }),
    ).toThrow('insufficient')
  })

  it('sweeps every UTXO that shares an address seed step and anchor', () => {
    const seededUTXO = (id: string, amount: string, step: number, anchorByte: number) => ({
      id,
      address: 'alice',
      coinType: 0,
      amount,
      input: {
        Position: { IndexZ: 0 },
        UTXO: {
          TXOutputs: [
            {
              SeedAnchor: Array.from({ length: 32 }, () => anchorByte),
              SeedChainStep: step,
            },
          ],
        },
      },
    })
    const seeded: WalletSpendableSnapshot = {
      utxos: [
        seededUTXO('u-1', '4', 1000, 1),
        seededUTXO('u-2', '3', 1000, 1),
        seededUTXO('u-3', '8', 999, 2),
      ],
      txCers: [],
    }

    expect(selectSpendableInputs(seeded, { coinType: 0, amount: '2' })).toMatchObject({
      utxoIDs: ['u-1', 'u-2'],
      total: '7',
      change: '5',
    })
    expect(
      selectSpendableInputs(seeded, {
        coinType: 0,
        amount: '2',
        reservedIDs: new Set(['u-2']),
      }),
    ).toMatchObject({ utxoIDs: ['u-3'], total: '8', change: '6' })
  })

  it('signs canonical material with a reusable P-256 envelope', () => {
    const privateKey = '1'.padStart(64, '0')
    const signed = signCanonicalMaterial({ Action: 'entry', AccountID: '12345678' }, privateKey)

    expect(signed.publicKey.Algorithm).toBe('ecdsa_p256')
    expect(verifyCanonicalMaterial({ Action: 'entry', AccountID: '12345678' }, signed)).toBe(true)
    expect(verifyCanonicalMaterial({ Action: 'other', AccountID: '12345678' }, signed)).toBe(false)
  })

  it('wraps a retail transaction in the authoritative no-group aggregate shape', () => {
    const tx = {
      TXID: 'a'.repeat(64),
      TXType: 8,
      Version: 2,
      GuarantorGroup: '',
      Value: '1',
      ValueDivision: { 0: '1' },
      NewValue: '0',
      NewValueDiv: {},
      InterestAssign: { Gas: '0', Output: '0', BackAssign: {} },
      TXInputsNormal: [],
      TXInputsCertificate: [],
      TXOutputs: [],
      Data: [],
    }
    const aggregate = buildRetailAggregateMaterial(tx)

    expect(aggregate).toMatchObject({
      AggrTXType: 2,
      IsGuarCommittee: false,
      IsNoGuarGroupTX: true,
      GuarantorGroupID: '',
      TXNum: 1,
      TotalGas: '0',
      Version: 1,
    })
    expect(aggregate.AllTransactions[0]?.TXType).toBe(8)

    const completed = buildRetailAggregate(tx)
    expect(completed.TXHash).toMatch(/^[A-Za-z0-9+/]{43}=$/)
    expect(completed.GuarantorGroupSig).toEqual({ R: null, S: null })
    expect(completed.TXSize).toBe(0)
  })

  it('matches Go UserNewTX SignStruct zeroed exclusions exactly', () => {
    const TX = { TXID: 'a'.repeat(64), TXType: 0 }
    const material = canonicalizeUserNewTXSignatureMaterial({ TX, UserID: '12345678' })

    expect(material).toMatchObject({
      UserID: '12345678',
      Height: 0,
      Sig: { R: null, S: null },
    })
    expect(material.TX).toMatchObject({
      TXID: TX.TXID,
      TXType: 0,
      Data: null,
      TXInputsNormal: null,
      TXInputsCertificate: null,
      TXOutputs: null,
      UserSignature: { R: null, S: null },
      UserSignatureV2: { Algorithm: '', Signature: null },
    })
  })
})
