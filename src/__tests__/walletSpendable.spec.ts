import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { GatewayClient } from '@/services/gatewayClient'
import { loadWalletSpendableSnapshot, normalizeWalletSpendableSnapshot } from '@/wallet/spendable'

function quoteUnsafeJsonIntegers(input: string): string {
  let output = ''
  let inString = false
  let escaped = false
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!
    if (inString) {
      output += character
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') {
      inString = true
      output += character
      continue
    }
    if (character === '-' || /\d/.test(character)) {
      const match = input.slice(index).match(/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/)
      if (match) {
        const token = match[0]
        const digits = token.replace(/^-/, '')
        output += /^-?\d+$/.test(token) && digits.length > 15 ? `"${token}"` : token
        index += token.length - 1
        continue
      }
    }
    output += character
  }
  return output
}

const golden = JSON.parse(
  quoteUnsafeJsonIntegers(
    fs.readFileSync(path.resolve('tests/fixtures/protocol-v2-golden.json'), 'utf8'),
  ),
)
const evidence = golden.evidence
const address = evidence.issuanceRecord.ToAddress
const userID = evidence.issuanceRecord.UserID
const amount = evidence.issuanceRecord.TXCer.Value

function addressResponse(value: unknown = amount): unknown {
  return {
    FromGroupID: 'committee',
    AddressData: {
      [address]: {
        Value: value,
        Type: 0,
        GroupID: 'group-target',
        UTXO: {
          'utxo-source-0': {
            UTXO: {
              TXID: 'f'.repeat(64),
              TXType: 0,
              Version: 2,
              TXOutputs: [{ Address: address, Value: value, Type: 0 }],
            },
            Value: value,
            Type: 0,
            Time: '1700000000001',
            Position: { Blocknum: 9, IndexX: 2, IndexY: 1, IndexZ: 0 },
            IsTXCerUTXO: false,
          },
        },
      },
    },
  }
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

describe('wallet spendable snapshot', () => {
  it('loads exact UTXO sources and verified full TXCer certificates from Gateway APIs', async () => {
    const calls: string[] = []
    const key = evidence.publicKey
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async (input) => {
        const url = String(input)
        calls.push(url)
        if (url.endsWith('/api/v1/re-online'))
          return response({
            UserID: userID,
            IsInGroup: true,
            GuarantorGroupID: 'group-target',
            UserWalletData: { SubAddressMsg: {} },
          })
        if (url.endsWith('/api/v1/com/query-address')) return response(addressResponse())
        if (url.includes('/assign/txcer-statuses'))
          return response({
            statuses: [{ TXCerID: evidence.txCerID, Status: 'Active', Address: address }],
          })
        if (url.includes('/aggr/txcer-issuance-records'))
          return response({ records: [{ ...evidence.issuanceRecord, Ack: evidence.assignAck }] })
        if (url.includes('/group-info')) {
          const source = url.includes('/group-source/')
          return response({
            GroupID: source ? 'group-source' : 'group-target',
            AssiID: source ? 'assign-source' : 'assign-target',
            AggrID: source ? 'aggregation' : 'aggregation-target',
            AssignPublicKeyNew: key,
            AggrPublicKeyNew: key,
          })
        }
        if (url.includes('/certifiers'))
          return response({
            certifiers: [
              { CertifierID: 'certifier', PublicKeyNew: key },
              { CertifierID: 'certifier-v2', PublicKeyNew: key },
            ],
          })
        throw new Error(`unexpected request ${url}`)
      },
    })

    const snapshot = await loadWalletSpendableSnapshot(client, {
      userID,
      addresses: [address],
      reOnlineMessage: { UserID: userID, Address: [address], Sig: { R: null, S: null } },
    })

    expect(snapshot.membership).toBe('member')
    expect(snapshot.guarantorGroupID).toBe('group-target')

    expect(snapshot.utxos).toEqual([
      expect.objectContaining({
        id: 'utxo-source-0',
        address,
        coinType: 0,
        amount,
        input: expect.objectContaining({
          UTXO: expect.objectContaining({ TXID: 'f'.repeat(64) }),
          Position: { Blocknum: 9, IndexX: 2, IndexY: 1, IndexZ: 0 },
        }),
      }),
    ])
    expect(snapshot.txCers).toEqual([
      expect.objectContaining({
        id: evidence.txCerID,
        address,
        coinType: 0,
        amount,
        lifecycle: 'Active',
        isolated: false,
        txCer: expect.objectContaining({
          TXCerID: evidence.txCerID,
          ExposureShares: expect.arrayContaining([
            expect.objectContaining({ RootID: 'root-a' }),
            expect.objectContaining({ RootID: 'root-b' }),
          ]),
        }),
      }),
    ])
    expect(calls.some((url) => url.endsWith('/api/v1/re-online'))).toBe(true)
    expect(calls.some((url) => url.endsWith('/api/v1/com/query-address'))).toBe(true)
    expect(calls.some((url) => url.includes('/assign/txcer-statuses'))).toBe(true)
    expect(calls.some((url) => url.includes('/aggr/txcer-issuance-records'))).toBe(true)
  })

  it('fails closed instead of rounding malformed UTXO amounts', () => {
    expect(() =>
      normalizeWalletSpendableSnapshot({
        userID,
        addresses: [address],
        addressResponse: addressResponse('1.000000001'),
      }),
    ).toThrow(/amount/i)
  })

  it('does not expose a source UTXO while its TXCer is still awaiting exchange', () => {
    const sourceTXID = 'f'.repeat(64)
    const snapshot = normalizeWalletSpendableSnapshot({
      userID,
      addresses: [address],
      addressResponse: addressResponse(),
      lifecycleResponse: {
        statuses: [
          {
            txCerID: evidence.txCerID,
            status: 'AwaitingExchange',
            sourceTXID,
            sourcePosition: { InIndex: 0 },
          },
        ],
      },
    })

    expect(snapshot.utxos).toEqual([])
  })

  it('does not expose a partial seed-sweep group when one sibling UTXO backs a TXCer', () => {
    const lockedTXID = 'a'.repeat(64)
    const peerTXID = 'b'.repeat(64)
    const independentTXID = 'c'.repeat(64)
    const seededOutput = (seedAnchor: string, seedChainStep: number, value: string) => ({
      ToAddress: address,
      ToValue: value,
      Type: 0,
      SeedAnchor: seedAnchor,
      SeedChainStep: seedChainStep,
    })
    const utxo = (txID: string, value: string, output: unknown) => ({
      UTXO: { TXID: txID, TXType: 0, Version: 2, TXOutputs: [output] },
      Value: value,
      Type: 0,
      Time: 1,
      Position: { Blocknum: 1, IndexX: 0, IndexY: 0, IndexZ: 0 },
      IsTXCerUTXO: false,
    })
    const snapshot = normalizeWalletSpendableSnapshot({
      userID,
      addresses: [address],
      addressResponse: {
        FromGroupID: 'committee',
        AddressData: {
          [address]: {
            Value: '105',
            Type: 0,
            GroupID: 'group-target',
            UTXO: {
              [`${lockedTXID} + 0`]: utxo(lockedTXID, '5', seededOutput('AQID', 1000, '5')),
              [`${peerTXID} + 0`]: utxo(peerTXID, '60', seededOutput('AQID', 1000, '60')),
              [`${independentTXID} + 0`]: utxo(
                independentTXID,
                '40',
                seededOutput('BAUG', 998, '40'),
              ),
            },
          },
        },
      },
      lifecycleResponse: {
        statuses: [
          {
            txCerID: evidence.txCerID,
            status: 'AwaitingExchange',
            sourceTXID: lockedTXID,
            sourcePosition: { InIndex: 0 },
          },
        ],
      },
    })

    expect(snapshot.utxos.map((item) => item.id)).toEqual([`${independentTXID} + 0`])
  })

  it('exposes a source UTXO after the TXCer is converted to UTXO', () => {
    const sourceTXID = 'f'.repeat(64)
    const snapshot = normalizeWalletSpendableSnapshot({
      userID,
      addresses: [address],
      addressResponse: addressResponse(),
      lifecycleResponse: {
        statuses: [
          {
            txCerID: evidence.txCerID,
            status: 'ConvertedToUTXO',
            sourceTXID,
            sourcePosition: { InIndex: 0 },
          },
        ],
      },
    })

    expect(snapshot.utxos).toHaveLength(1)
  })

  it('accepts an Active TXCer delivered by the target Assign even when the target Aggregation has no record', async () => {
    const key = evidence.publicKey
    const client = new GatewayClient({
      baseURL: 'http://gateway.test',
      fetcher: async (input) => {
        const url = String(input)
        if (url.endsWith('/api/v1/re-online'))
          return response({ UserID: userID, IsInGroup: true, GuarantorGroupID: 'group-target' })
        if (url.endsWith('/api/v1/com/query-address')) return response(addressResponse())
        if (url.includes('/assign/txcer-statuses'))
          return response({
            statuses: [{ TXCerID: evidence.txCerID, Status: 'Active', Address: address }],
          })
        if (url.includes('/aggr/txcer-issuance-records')) return response({ records: [] })
        if (url.includes('/assign/poll-cross-org-txcers'))
          return response({
            success: true,
            txcers: [
              {
                ToAddress: address,
                TXCer: evidence.txCer,
                IssuanceRecordID: evidence.issuanceRecord.RecordID,
                IssuanceStatus: 'Delivered',
                IssuanceProof: evidence.issueProof,
                IssuanceRecord: { ...evidence.issuanceRecord, Ack: evidence.assignAck },
                IssueBatchID: evidence.issuanceRecord.BatchID,
                LiabilityReceipt: evidence.liabilityReceipt,
              },
            ],
          })
        if (url.includes('/group-info')) {
          const source = url.includes('/group-source/')
          return response({
            GroupID: source ? 'group-source' : 'group-target',
            AssiID: source ? 'assign-source' : 'assign-target',
            AggrID: source ? 'aggregation' : 'aggregation-target',
            AssignPublicKeyNew: key,
            AggrPublicKeyNew: key,
          })
        }
        if (url.includes('/certifiers'))
          return response({
            certifiers: [
              { CertifierID: 'certifier', PublicKeyNew: key },
              { CertifierID: 'certifier-v2', PublicKeyNew: key },
            ],
          })
        throw new Error(`unexpected request ${url}`)
      },
    })

    const snapshot = await loadWalletSpendableSnapshot(client, {
      userID,
      addresses: [address],
      reOnlineMessage: { UserID: userID },
    })

    expect(snapshot.receivedTXCers).toHaveLength(1)
    expect(snapshot.txCers).toEqual([
      expect.objectContaining({
        id: evidence.txCerID,
        lifecycle: 'Active',
        isolated: false,
      }),
    ])
  })

  it('fails closed when the authoritative UTXO source transaction is absent', () => {
    const malformed = addressResponse() as {
      AddressData: Record<string, { UTXO: Record<string, Record<string, unknown>> }>
    }
    delete malformed.AddressData[address]!.UTXO['utxo-source-0']!.UTXO
    expect(() =>
      normalizeWalletSpendableSnapshot({
        userID,
        addresses: [address],
        addressResponse: malformed,
      }),
    ).toThrow(/source transaction/i)
  })

  it('isolates a certificate whose evidence fails verification', () => {
    const tampered = structuredClone(evidence.issuanceRecord)
    tampered.FastEvidence.TXCerID = '0'.repeat(64)
    const snapshot = normalizeWalletSpendableSnapshot({
      userID,
      addresses: [address],
      addressResponse: addressResponse(),
      issuanceResponse: { records: [tampered] },
      lifecycleResponse: {
        statuses: [{ TXCerID: evidence.txCerID, Status: 'Active', Address: address }],
      },
      authorities: {
        [evidence.txCerID]: {
          groupID: 'group-source',
          signerSetID: evidence.liabilityReceipt.SignerSetID,
          members: evidence.liabilityAuthority,
          threshold: evidence.liabilityThreshold,
          publicKeys: {
            aggregation: evidence.publicKey,
            certifier: evidence.publicKey,
            'certifier-v2': evidence.publicKey,
            'certifier:certifier-v2': evidence.publicKey,
            'assign-target': evidence.publicKey,
          },
          sourceAggregationPublicKey: evidence.publicKey,
          sourceAssignPublicKey: evidence.publicKey,
          targetAssignPublicKey: evidence.publicKey,
          capturedAt: 1,
        },
      },
    })

    expect(snapshot.txCers[0]?.isolated).toBe(true)
  })
})
