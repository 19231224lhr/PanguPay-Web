import { addAmounts, formatAmount, parseAmount } from '@/protocol-v2/amount'
import type { WalletDashboardSnapshot } from '@/wallet/types'

export interface RawDashboardAddress {
  address: string
  type: string
  utxos: Array<{ value: string }>
  txCers: Array<{
    id: string
    value: string
    lifecycle: string
    fastEvidence: 'Pending' | 'Verified' | 'Failed'
  }>
}

export interface RawDashboardInput {
  accountId: string
  displayName: string
  addresses: RawDashboardAddress[]
  updatedAt: number
}

export function shouldAnimateBalance(
  previous: WalletDashboardSnapshot | undefined,
  next: WalletDashboardSnapshot,
  manual: boolean,
): boolean {
  if (manual || previous?.source !== 'live') return true
  const fingerprint = (snapshot: WalletDashboardSnapshot) =>
    snapshot.assets
      .map(
        (asset) => `${asset.symbol}:${asset.total}:${asset.utxoAvailable}:${asset.txCerSpendable}`,
      )
      .join('|')
  return fingerprint(previous) !== fingerprint(next)
}

export function buildDashboardSnapshot(input: RawDashboardInput): WalletDashboardSnapshot {
  let utxoUnits = 0n
  let txCerUnits = 0n
  let isolatedCount = 0
  let pendingAudits = 0

  const addresses = input.addresses.map((address) => {
    const balance = address.utxos.reduce((sum, utxo) => sum + parseAmount(utxo.value), 0n)
    let spendable = 0n
    for (const txCer of address.txCers) {
      if (txCer.fastEvidence === 'Failed') isolatedCount += 1
      else if (txCer.lifecycle === 'Active') {
        spendable += parseAmount(txCer.value)
        if (txCer.fastEvidence === 'Pending') pendingAudits += 1
      }
    }
    utxoUnits += balance
    txCerUnits += spendable
    return {
      address: address.address,
      type: address.type,
      balance: formatAmount(balance),
      txCerBalance: formatAmount(spendable),
    }
  })

  const total = addAmounts(formatAmount(utxoUnits), formatAmount(txCerUnits))
  return {
    accountId: input.accountId,
    displayName: input.displayName,
    addresses,
    assets: [
      {
        symbol: 'PGC',
        name: 'Pangu Coin',
        total,
        utxoAvailable: formatAmount(utxoUnits),
        txCerSpendable: formatAmount(txCerUnits),
        network: 'Transfer Area',
      },
    ],
    security: {
      spendReady: formatAmount(txCerUnits),
      credentialStatus: isolatedCount > 0 ? 'warning' : 'normal',
      pendingAudits,
      isolatedCount,
    },
    credentials: [],
    activities: [],
    updatedAt: input.updatedAt,
    source: input.updatedAt > 0 ? 'live' : 'empty',
  }
}
