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
