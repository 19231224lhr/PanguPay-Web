import { describe, expect, it } from 'vitest'

import { buildDashboardSnapshot, shouldAnimateBalance } from '@/wallet/dashboard'

describe('wallet dashboard normalization', () => {
  it('aggregates exact UTXO and spendable TXCer balances without Number', () => {
    const snapshot = buildDashboardSnapshot({
      accountId: '68740417',
      displayName: '6874 0417',
      addresses: [
        {
          address: 'abc',
          type: '0',
          utxos: [{ value: '90071992.54740993' }, { value: '0.00000001' }],
          txCers: [
            { id: 'active', value: '2.00000000', lifecycle: 'Active', fastEvidence: 'Verified' },
            { id: 'isolated', value: '7', lifecycle: 'Active', fastEvidence: 'Failed' },
          ],
        },
      ],
      updatedAt: 10,
    })

    expect(snapshot.assets[0]).toMatchObject({
      symbol: 'PGC',
      utxoAvailable: '90071992.54740994',
      txCerSpendable: '2',
      total: '90071994.54740994',
    })
    expect(snapshot.security.isolatedCount).toBe(1)
  })

  it('keeps PGC, BTC and ETH balances in separate asset ledgers', () => {
    const snapshot = buildDashboardSnapshot({
      accountId: '68740417',
      displayName: '6874 0417',
      addresses: [
        {
          address: 'pgc-address',
          type: '0',
          utxos: [{ value: '12.5' }],
          txCers: [
            { id: 'pgc-txcer', value: '1.25', lifecycle: 'Active', fastEvidence: 'Verified' },
          ],
        },
        {
          address: 'btc-address',
          type: '1',
          utxos: [{ value: '0.0042' }],
          txCers: [],
        },
        {
          address: 'eth-address',
          type: '2',
          utxos: [{ value: '2.75' }],
          txCers: [],
        },
      ],
      updatedAt: 10,
    })

    expect(snapshot.assets).toEqual([
      {
        symbol: 'PGC',
        name: 'Pangu Coin',
        total: '13.75',
        utxoAvailable: '12.5',
        txCerSpendable: '1.25',
        network: 'Transfer Area',
      },
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        total: '0.0042',
        utxoAvailable: '0.0042',
        txCerSpendable: '0',
        network: 'Transfer Area',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        total: '2.75',
        utxoAvailable: '2.75',
        txCerSpendable: '0',
        network: 'Transfer Area',
      },
    ])
    expect(snapshot.security.spendReady).toBe('1.25')
  })

  it('does not isolate a failed historical TXCer that already converted to UTXO', () => {
    const snapshot = buildDashboardSnapshot({
      accountId: '68740417',
      displayName: '6874 0417',
      addresses: [
        {
          address: 'abc',
          type: '0',
          utxos: [{ value: '95' }],
          txCers: [
            {
              id: 'converted-history',
              value: '90',
              lifecycle: 'ConvertedToUTXO',
              fastEvidence: 'Failed',
            },
          ],
        },
      ],
      updatedAt: 10,
    })

    expect(snapshot.security.isolatedCount).toBe(0)
    expect(snapshot.security.credentialStatus).toBe('normal')
    expect(snapshot.assets[0]).toMatchObject({
      utxoAvailable: '95',
      txCerSpendable: '0',
      total: '95',
    })
  })

  it('animates only the first live snapshot, manual refresh or an actual balance change', () => {
    const make = (value: string, updatedAt: number) =>
      buildDashboardSnapshot({
        accountId: '68740417',
        displayName: '6874 0417',
        addresses: [{ address: 'abc', type: '0', utxos: [{ value }], txCers: [] }],
        updatedAt,
      })
    const first = make('1', 10)
    const sameBalance = make('1', 20)
    const changedBalance = make('2', 30)

    expect(shouldAnimateBalance(undefined, first, false)).toBe(true)
    expect(shouldAnimateBalance(first, sameBalance, false)).toBe(false)
    expect(shouldAnimateBalance(first, sameBalance, true)).toBe(true)
    expect(shouldAnimateBalance(sameBalance, changedBalance, false)).toBe(true)
  })
})
