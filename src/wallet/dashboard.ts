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

const assetTypes: Record<string, { symbol: string; name: string; network: string }> = {
  '0': { symbol: 'PGC', name: 'Pangu Coin', network: 'Transfer Area' },
  '1': { symbol: 'BTC', name: 'Bitcoin', network: 'Transfer Area' },
  '2': { symbol: 'ETH', name: 'Ethereum', network: 'Transfer Area' },
}

export function assetIdentityForType(type: string): {
  symbol: string
  name: string
  network: string
} {
  const normalized = String(type).trim()
  return (
    assetTypes[normalized] ?? {
      symbol: `TYPE-${normalized || '?'}`,
      name: `Asset type ${normalized || '?'}`,
      network: 'Transfer Area',
    }
  )
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
  const balances = new Map<string, { utxo: bigint; txCer: bigint }>()
  let isolatedCount = 0
  let pendingAudits = 0

  const addresses = input.addresses.map((address) => {
    const balance = address.utxos.reduce((sum, utxo) => sum + parseAmount(utxo.value), 0n)
    let spendable = 0n
    for (const txCer of address.txCers) {
      if (txCer.lifecycle !== 'Active') continue
      if (txCer.fastEvidence === 'Failed') isolatedCount += 1
      else {
        spendable += parseAmount(txCer.value)
        if (txCer.fastEvidence === 'Pending') pendingAudits += 1
      }
    }
    const totals = balances.get(address.type) ?? { utxo: 0n, txCer: 0n }
    totals.utxo += balance
    totals.txCer += spendable
    balances.set(address.type, totals)
    return {
      address: address.address,
      type: address.type,
      balance: formatAmount(balance),
      txCerBalance: formatAmount(spendable),
    }
  })

  const assets = [...balances.entries()]
    .sort(([left], [right]) => Number(left) - Number(right) || left.localeCompare(right))
    .map(([type, balance]) => {
      const identity = assetIdentityForType(type)
      return {
        ...identity,
        total: addAmounts(formatAmount(balance.utxo), formatAmount(balance.txCer)),
        utxoAvailable: formatAmount(balance.utxo),
        txCerSpendable: formatAmount(balance.txCer),
      }
    })
  const pgcSpendReady = balances.get('0')?.txCer ?? 0n
  return {
    accountId: input.accountId,
    displayName: input.displayName,
    addresses,
    assets,
    security: {
      spendReady: formatAmount(pgcSpendReady),
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
