import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  bytesToHex,
  canonicalJSONStringify,
  canonicalizeTransactionV2,
  computeSettlementIntentHashV2,
  computeTransactionHashV2,
  computeTransactionIDV2,
  formatAmount,
  parseAmount,
  parseRatio,
  verifySignatureEnvelopeV2,
} from '../src/protocol-v2'

const fixturePath = path.resolve('tests/fixtures/protocol-v2-golden.json')

function quoteUnsafeJsonIntegers(input: string): string {
  let output = ''
  let inString = false
  let escaped = false

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]
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

const fixtureText = quoteUnsafeJsonIntegers(fs.readFileSync(fixturePath, 'utf8'))
const golden = JSON.parse(fixtureText)

describe('Go protocol-v2 golden vectors', () => {
  it('matches exact amount and ratio parsing', () => {
    for (const vector of golden.amounts.filter((item: { valid: boolean }) => item.valid)) {
      const units = parseAmount(vector.input)
      expect(units.toString()).toBe(vector.units)
      expect(formatAmount(units)).toBe(vector.canonical)
    }

    for (const vector of golden.amounts.filter((item: { valid: boolean }) => !item.valid)) {
      expect(() => parseAmount(vector.input)).toThrow(/amount|decimal|number|precision|range/i)
    }

    for (const vector of golden.ratios.filter((item: { valid: boolean }) => item.valid)) {
      expect(parseRatio(vector.input).toString()).toBe(vector.units)
    }

    for (const vector of golden.ratios.filter((item: { valid: boolean }) => !item.valid)) {
      expect(() => parseRatio(vector.input)).toThrow(/ratio|decimal|number|precision|range/i)
    }
  })

  it('matches Go canonical transactions, full TXIDs and signatures', () => {
    for (const vector of golden.transactions) {
      expect(canonicalJSONStringify(canonicalizeTransactionV2(vector.transaction))).toBe(
        vector.canonicalJSON,
      )
      expect(bytesToHex(computeTransactionHashV2(vector.transaction))).toBe(vector.hashHex)
      expect(computeTransactionIDV2(vector.transaction)).toBe(vector.txID)
      expect(vector.txID).toMatch(/^[a-f0-9]{64}$/)
      expect(
        verifySignatureEnvelopeV2(
          computeTransactionHashV2(vector.transaction),
          vector.transaction.UserSignatureV2,
          vector.userPublicKeyV2,
        ),
      ).toBe(true)
      expect(
        bytesToHex(computeSettlementIntentHashV2(vector.transaction, vector.settlementTXCerID)),
      ).toBe(vector.settlementIntentHashHex)
    }
  })

  it('normalizes map order and Go byte representations', () => {
    for (const vector of golden.transactions) {
      const variant = structuredClone(vector.transaction)
      variant.ValueDivision = Object.fromEntries(
        Object.entries(variant.ValueDivision || {}).reverse(),
      )
      variant.NewValueDiv = Object.fromEntries(Object.entries(variant.NewValueDiv || {}).reverse())
      expect(computeTransactionIDV2(variant)).toBe(vector.txID)
    }
  })
})
