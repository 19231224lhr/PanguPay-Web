import { ec as EC } from 'elliptic'
import { describe, expect, it } from 'vitest'

import { formatAmount, parseAmount } from '@/protocol-v2/amount'
import {
  bytesToBase64,
  canonicalJSONStringify,
  hexToBytes,
  sha256Bytes,
  verifyECDSAHash,
  verifySignatureEnvelopeV2,
} from '@/protocol-v2/canonical'
import {
  canonicalizeTXCerSourceSignatureMaterialV2,
  computeSettlementAuthHashV2,
  computeSettlementIntentHashV2,
  computeTXCerIDV2,
  computeTXOutputHashCompatV2,
  computeTransactionHashV2,
} from '@/protocol-v2/transaction'
import type { PublicKeyV2, TXCerV2 } from '@/protocol-v2/types'
import { buildTransferTransaction } from '@/transfer/builder'
import {
  canonicalizeUserNewTXSignatureMaterial,
  type InputSelection,
  type SpendableTXCer,
  type SpendableUTXO,
} from '@/transfer/core'
import type { RecipientSpendMetadata } from '@/transfer/recipient'
import { deriveAddressFromRootSeed, accountIdFromPrivateScalar } from '@/wallet/identity'
import type { WalletRecord } from '@/wallet/types'

const ec = new EC('p256')
const ACCOUNT_PRIVATE = '1'.padStart(64, '0')
const ROOT_SEED = '02'.repeat(32)
const derivedAddress = deriveAddressFromRootSeed(ROOT_SEED, 0)

const wallet: WalletRecord = {
  account_id: accountIdFromPrivateScalar(ACCOUNT_PRIVATE),
  account_private_scalar: bytesToBase64(hexToBytes(ACCOUNT_PRIVATE)),
  addresses: [
    {
      address: derivedAddress.address,
      type: '0',
      root_seed: bytesToBase64(hexToBytes(ROOT_SEED)),
    },
  ],
}

function keyCoordinates(publicKeyHex: string): PublicKeyV2 {
  expect(publicKeyHex.slice(0, 2)).toBe('04')
  return {
    CurveName: 'P256',
    X: BigInt(`0x${publicKeyHex.slice(2, 66)}`),
    Y: BigInt(`0x${publicKeyHex.slice(66)}`),
  }
}

const addressPublicKey = keyCoordinates(derivedAddress.publicKeyHex)

function seedAnchor(privateKeyHex: string, step: number): number[] {
  const domain = new TextEncoder().encode('pangu-seedchain-v2:0:')
  let reveal = sha256Bytes([...domain, ...hexToBytes(privateKeyHex)])
  reveal = sha256Bytes(reveal)
  for (let index = 0; index < step; index += 1) reveal = sha256Bytes(reveal)
  return sha256Bytes(reveal)
}

function spendableUTXO(amount = '3', id = 'utxo-1'): SpendableUTXO {
  const referencedOutput = {
    ToAddress: derivedAddress.address,
    ToValue: amount,
    ToGuarGroupID: 'group-source',
    ToPublicKey: addressPublicKey,
    ToInterest: '0',
    Type: 0,
    ToPeerID: '',
    IsPayForGas: false,
    IsCrossChain: false,
    IsGuarMake: false,
    SeedAnchor: seedAnchor(derivedAddress.privateScalarHex, 2),
    SeedChainStep: 2,
    DefaultSpendAlgorithm: 'ecdsa_p256',
  }
  return {
    id,
    address: derivedAddress.address,
    coinType: 0,
    amount,
    input: {
      UTXO: { TXID: 'a'.repeat(64), TXOutputs: [referencedOutput] },
      Value: amount,
      Type: 0,
      Position: { Blocknum: 9, IndexX: 2, IndexY: 1, IndexZ: 0 },
    },
  }
}

function spendableTXCer(amount = '2', idSuffix = 'b'): SpendableTXCer {
  const txCer: TXCerV2 = {
    TXCerID: '',
    ToAddress: derivedAddress.address,
    Value: amount,
    ToInterest: '0',
    FromGuarGroupID: 'group-source',
    ToGuarGroupID: 'group-member',
    SourcePledgeAddress: 'pledge-source',
    ConstructionTime: 1_700_000_000,
    Size: 0,
    ExposureShares: [],
    TXID: idSuffix.repeat(64),
    TxCerPosition: { BlockHeight: 9, Index: 2, InIndex: 1 },
    GuarGroupSignature: { R: 11n, S: 13n },
    UserSignature: { R: null, S: null },
    UserSignatureV2: { Algorithm: '', Signature: null },
  }
  txCer.TXCerID = computeTXCerIDV2(txCer)
  return {
    id: txCer.TXCerID,
    address: derivedAddress.address,
    coinType: 0,
    amount,
    lifecycle: 'Active',
    txCer,
  }
}

function selection(
  amount: string,
  utxos: SpendableUTXO[],
  txCers: SpendableTXCer[] = [],
): InputSelection {
  const total = [...utxos, ...txCers].reduce((sum, input) => sum + parseAmount(input.amount), 0n)
  return {
    utxos,
    txCers,
    utxoIDs: utxos.map((input) => input.id),
    txCerIDs: txCers.map((input) => input.id),
    total: formatAmount(total),
    change: formatAmount(total - parseAmount(amount)),
  }
}

const recipient: RecipientSpendMetadata = {
  address: 'b'.repeat(40),
  groupID: 'group-target',
  publicKey: addressPublicKey,
  seedAnchor: Array.from({ length: 32 }, () => 7),
  seedChainStep: 1000,
  defaultSpendAlgorithm: 'ecdsa_p256',
  coinType: 0,
}

const crossRecipient: RecipientSpendMetadata = {
  address: `0x${'c'.repeat(40)}`,
  groupID: '',
  publicKey: { CurveName: 'P256', X: 0n, Y: 0n },
  seedAnchor: [],
  seedChainStep: 0,
  defaultSpendAlgorithm: '',
  coinType: 0,
}

const changeRecipient: RecipientSpendMetadata = {
  address: derivedAddress.address,
  groupID: 'group-member',
  publicKey: addressPublicKey,
  seedAnchor: Array.from({ length: 32 }, () => 9),
  seedChainStep: 999,
  defaultSpendAlgorithm: 'ecdsa_p256',
  coinType: 0,
}

function accountPublicKeyEnvelope() {
  return {
    Algorithm: 'ecdsa_p256',
    PublicKey: hexToBytes(
      ec.keyFromPrivate(ACCOUNT_PRIVATE, 'hex').getPublic().encode('hex', false),
    ),
  }
}

function expectAccountAndOuterSignatures(result: ReturnType<typeof buildTransferTransaction>) {
  const accountKey = accountPublicKeyEnvelope()
  expect(
    verifySignatureEnvelopeV2(
      computeTransactionHashV2(result.tx),
      result.tx.UserSignatureV2,
      accountKey,
    ),
  ).toBe(true)
  expect(result.submission.kind).toBe('assign')
  if (result.submission.kind !== 'assign') throw new Error('expected assign submission')
  const outer = result.submission.body
  const outerHash = sha256Bytes(
    canonicalJSONStringify(canonicalizeUserNewTXSignatureMaterial(outer)),
  )
  expect(
    ec.keyFromPrivate(ACCOUNT_PRIVATE, 'hex').verify(outerHash, {
      r: outer.Sig.R!.toString(16),
      s: outer.Sig.S!.toString(16),
    }),
  ).toBe(true)
}

describe('transfer builder', () => {
  it('returns pure TXCer change using authoritative source-address metadata', () => {
    const result = buildTransferTransaction({
      wallet,
      guarantorGroupID: 'group-member',
      authTime: 1_700_000_000,
      draft: {
        mode: 'quick',
        membership: 'member',
        coinType: 0,
        amount: '1',
        recipient: recipient.address,
        usesTXCer: true,
      },
      selection: selection('1', [], [spendableTXCer('2')]),
      recipient,
      change: changeRecipient,
    })

    expect(result.tx.TXInputsNormal).toHaveLength(0)
    expect(result.tx.TXInputsCertificate).toHaveLength(1)
    expect(result.tx.TXOutputs).toHaveLength(2)
    expect(result.tx.TXOutputs?.[1]).toMatchObject({
      ToAddress: derivedAddress.address,
      ToValue: '1',
      SeedChainStep: 999,
    })
  })

  it('builds retail normal TXType=8 as a signed AggregateGTX with exact UTXO proofs', () => {
    const selected = selection('2', [spendableUTXO('3')])
    const result = buildTransferTransaction({
      wallet,
      draft: {
        mode: 'normal',
        membership: 'retail',
        coinType: 0,
        amount: '2',
        recipient: recipient.address,
        usesTXCer: false,
      },
      selection: selected,
      recipient,
    })

    expect(result.tx.TXType).toBe(8)
    expect(result.tx.Value).toBe('2')
    expect(result.tx.ValueDivision).toEqual({ 0: '2' })
    expect(result.tx.TXID).toMatch(/^[0-9a-f]{64}$/)
    expect(result.txID).toBe(result.tx.TXID)
    expect(result.inputIDs).toEqual(['utxo-1'])
    expect(result.tx.TXOutputs).toHaveLength(2)
    expect(result.tx.TXOutputs?.[0]).toMatchObject({ ToAddress: recipient.address, ToValue: '2' })
    expect(result.tx.TXOutputs?.[1]).toMatchObject({
      ToAddress: derivedAddress.address,
      ToValue: '1',
      SeedChainStep: 1,
    })

    const referenced = (selected.utxos[0]!.input.UTXO as { TXOutputs: unknown[] }).TXOutputs[0]
    const outputHash = computeTXOutputHashCompatV2(referenced)
    const input = result.tx.TXInputsNormal?.[0]
    expect(input.TXOutputHash).toEqual(outputHash)
    expect(verifyECDSAHash(outputHash, input.InputSignature, addressPublicKey)).toBe(true)
    expect(
      verifySignatureEnvelopeV2(outputHash, input.InputSignatureV2, input.SeedPublicKeyV2),
    ).toBe(true)
    expect(
      verifySignatureEnvelopeV2(
        computeTransactionHashV2(result.tx),
        result.tx.UserSignatureV2,
        accountPublicKeyEnvelope(),
      ),
    ).toBe(true)
    expect(result.submission).toMatchObject({ kind: 'retail' })
    if (result.submission.kind !== 'retail') throw new Error('expected retail submission')
    expect(result.submission.body).toMatchObject({
      AggrTXType: 2,
      IsNoGuarGroupTX: true,
      TXNum: 1,
    })
  })

  it('builds member normal TXType=0 as a fully signed UserNewTX', () => {
    const result = buildTransferTransaction({
      wallet,
      guarantorGroupID: 'group-member',
      draft: {
        mode: 'normal',
        membership: 'member',
        coinType: 0,
        amount: '2',
        recipient: recipient.address,
        usesTXCer: false,
      },
      selection: selection('2', [spendableUTXO('2')]),
      recipient,
    })

    expect(result.tx.TXType).toBe(0)
    expect(result.submission).toMatchObject({ kind: 'assign', groupID: 'group-member' })
    expectAccountAndOuterSignatures(result)
  })

  it('accepts an explicitly resolved no-group recipient without weakening key metadata', () => {
    const noGroupRecipient = { ...recipient, groupID: '' }
    const result = buildTransferTransaction({
      wallet,
      draft: {
        mode: 'normal',
        membership: 'retail',
        coinType: 0,
        amount: '2',
        recipient: noGroupRecipient.address,
        usesTXCer: false,
      },
      selection: selection('2', [spendableUTXO('2')]),
      recipient: noGroupRecipient,
    })

    expect(result.tx.TXOutputs?.[0]?.ToGuarGroupID).toBe('')
  })

  it.each([
    ['UTXO-only', [spendableUTXO('2')], [], false, 0],
    ['TXCer-only', [], [spendableTXCer('2')], true, 1],
    ['mixed', [spendableUTXO('1')], [spendableTXCer('2', 'd')], true, 1],
  ] as const)(
    'builds quick %s transactions with the authoritative TXType',
    (_label, utxos, txCers, usesTXCer, txType) => {
      const amount = txCers.length > 0 && utxos.length > 0 ? '3' : '2'
      const result = buildTransferTransaction({
        wallet,
        guarantorGroupID: 'group-member',
        authTime: 1_700_000_000,
        draft: {
          mode: 'quick',
          membership: 'member',
          coinType: 0,
          amount,
          recipient: recipient.address,
          usesTXCer,
        },
        selection: selection(amount, [...utxos], [...txCers]),
        recipient,
      })

      expect(result.tx.TXType).toBe(txType)
      expect(result.tx.TXInputsNormal).toHaveLength(utxos.length)
      expect(result.tx.TXInputsCertificate).toHaveLength(txCers.length)
      expectAccountAndOuterSignatures(result)
      for (const certificate of result.tx.TXInputsCertificate ?? []) {
        const sourceHash = sha256Bytes(
          canonicalJSONStringify(canonicalizeTXCerSourceSignatureMaterialV2(certificate)),
        )
        expect(
          verifySignatureEnvelopeV2(
            sourceHash,
            certificate.UserSignatureV2,
            accountPublicKeyEnvelope(),
          ),
        ).toBe(true)
        expect(certificate.SettlementAuth?.ConsumeIntentHash).toEqual(
          computeSettlementIntentHashV2(result.tx, String(certificate.TXCerID)),
        )
        expect(
          verifySignatureEnvelopeV2(
            computeSettlementAuthHashV2(certificate.SettlementAuth!),
            certificate.SettlementAuth?.UserSignatureV2,
            accountPublicKeyEnvelope(),
          ),
        ).toBe(true)
      }
    },
  )

  it('builds cross-chain TXType=6 only for whole PGC, one cross output and UTXO inputs', () => {
    const result = buildTransferTransaction({
      wallet,
      guarantorGroupID: 'group-member',
      draft: {
        mode: 'cross',
        membership: 'member',
        coinType: 0,
        amount: '2',
        recipient: crossRecipient.address,
        usesTXCer: false,
      },
      selection: selection('2', [spendableUTXO('2')]),
      recipient: crossRecipient,
    })

    expect(result.tx).toMatchObject({ TXType: 6, Value: '2', Data: [] })
    expect(result.tx.TXInputsCertificate).toEqual([])
    expect(result.tx.TXOutputs).toEqual([
      expect.objectContaining({
        ToAddress: crossRecipient.address,
        IsCrossChain: true,
        SeedAnchor: [],
        SeedChainStep: 0,
        DefaultSpendAlgorithm: '',
      }),
    ])
    expectAccountAndOuterSignatures(result)
  })

  it('fails closed when wallet, authoritative UTXO material or recipient metadata is incomplete', () => {
    const malformedWallet = structuredClone(wallet)
    malformedWallet.account_private_scalar = bytesToBase64(Array.from({ length: 32 }, () => 0))
    const selected = selection('2', [spendableUTXO('2')])
    const common = {
      draft: {
        mode: 'normal' as const,
        membership: 'member' as const,
        coinType: 0,
        amount: '2',
        recipient: recipient.address,
        usesTXCer: false,
      },
      selection: selected,
      recipient,
      guarantorGroupID: 'group-member',
    }
    expect(() => buildTransferTransaction({ ...common, wallet: malformedWallet })).toThrow(
      /private scalar/i,
    )

    const malformedSelection = structuredClone(selected)
    delete (malformedSelection.utxos[0]!.input.UTXO as { TXOutputs?: unknown }).TXOutputs
    expect(() =>
      buildTransferTransaction({ ...common, wallet, selection: malformedSelection }),
    ).toThrow(/TXOutputs/)

    expect(() =>
      buildTransferTransaction({
        ...common,
        wallet,
        recipient: { ...recipient, seedAnchor: [] },
      }),
    ).toThrow(/seed anchor/i)
  })
})
