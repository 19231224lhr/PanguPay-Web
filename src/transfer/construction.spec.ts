import { expect, it } from 'vitest'

import { parseTransactionReference, readTransactionConstruction } from './construction'

it('projects certified references and outputs without retaining signing material', () => {
  const source = 'a'.repeat(64)
  const address = 'b'.repeat(40)
  const receiver = 'c'.repeat(40)
  const certificate = 'd'.repeat(64)
  const result = readTransactionConstruction({
    TXInputsNormal: [{
      FromTXID: source, FromAddress: address, FromTxPosition: { Blocknum: 5, IndexZ: 0 },
      SeedReveal: 'never store this', InputSignatureV2: { Signature: 'never store this' },
    }],
    TXInputsCertificate: [{ TXCerID: certificate, ToAddress: address, Value: '2' }],
    TXOutputs: [{ ToAddress: receiver, ToValue: '2.75', Type: 0 }],
  })

  expect(result).toEqual({
    inputs: [
      { kind: 'utxo', address, reference: source, outputIndex: 0, sourceHeight: 5, amount: undefined },
      { kind: 'txcer', address, reference: certificate, amount: '2' },
    ],
    outputs: [{ index: 0, address: receiver, amount: '2.75', coinType: 0 }],
  })
})

it('adds the selected UTXO amount for a new outgoing transfer', () => {
  const result = readTransactionConstruction(
    { TXInputsNormal: [{ FromAddress: 'b'.repeat(40) }] },
    ['0.00000001'],
  )
  expect(result?.inputs[0]?.amount).toBe('0.00000001')
  expect(readTransactionConstruction({ TXID: 'a'.repeat(64) })).toBeUndefined()
})

it('retains output indexes when a preceding output is unavailable', () => {
  const txId = 'aa'.repeat(32)
  const parsed = parseTransactionReference(`${txId.toUpperCase()} + 1`)
  expect(parsed).toEqual({ txId, outputIndex: 1 })
  expect(parseTransactionReference(`${txId} + 9007199254740992`)).toBeUndefined()

  const construction = readTransactionConstruction({
    TXInputsNormal: [{ FromTXID: `${txId}:1`, FromTxPosition: { IndexZ: 0 } }],
    TXOutputs: [null, { ToAddress: 'b'.repeat(40), ToValue: '2', Type: 0 }],
  })
  expect(construction?.inputs[0]).toMatchObject({ reference: txId, outputIndex: 1 })
  expect(construction?.outputs[0]?.index).toBe(1)
})
