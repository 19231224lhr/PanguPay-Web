import { beforeEach, describe, expect, it } from 'vitest'

import {
  clearTransferReservation,
  loadTransferReservations,
  reserveTransferInputs,
} from '@/transfer/reservations'

describe('transfer input reservations', () => {
  beforeEach(() => localStorage.clear())

  it('persists only public input identifiers and rejects overlap', () => {
    reserveTransferInputs('account-a', 'draft-a', ['utxo-a', 'txcer-a'])

    expect(loadTransferReservations('account-a')).toEqual({
      'draft-a': ['txcer-a', 'utxo-a'],
    })
    expect(() => reserveTransferInputs('account-a', 'draft-b', ['utxo-a'])).toThrow(
      'input already reserved',
    )
  })

  it('is idempotent for the same draft and releases only that draft', () => {
    reserveTransferInputs('account-a', 'draft-a', ['utxo-a'])
    reserveTransferInputs('account-a', 'draft-a', ['utxo-a'])
    reserveTransferInputs('account-a', 'draft-b', ['utxo-b'])

    clearTransferReservation('account-a', 'draft-a')

    expect(loadTransferReservations('account-a')).toEqual({ 'draft-b': ['utxo-b'] })
  })

  it('fails closed on damaged persisted data', () => {
    localStorage.setItem('pangupay-transfer-reservations:account-a', '{bad')
    expect(() => loadTransferReservations('account-a')).toThrow('reservation storage is damaged')
  })
})
