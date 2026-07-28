import { canonicalAmount } from '@/protocol-v2/amount'
import type { RawDashboardAddress } from '@/wallet/dashboard'
import { blockedTXCerSourceOutputs, utxoSourceOutputKey } from '@/wallet/txcerLifecycle'
import type { OrganizationSummary, WalletActivity } from '@/wallet/types'

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
}

function first(recordValue: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) if (recordValue[key] != null) return recordValue[key]
  return undefined
}

function array(value: unknown): unknown[] {
  if (Array.isArray(value)) return value
  const object = record(value)
  for (const key of ['items', 'records', 'statuses', 'data', 'result'])
    if (Array.isArray(object[key])) return object[key] as unknown[]
  return []
}

function amount(value: unknown): string {
  try {
    return canonicalAmount(
      typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint'
        ? value
        : '0',
    )
  } catch {
    return '0'
  }
}

export function normalizeAddressState(
  addresses: Array<{ address: string; type: string }>,
  response: unknown,
  txCerResponse?: unknown,
  credentialStatuses: ReadonlyMap<string, 'Pending' | 'Verified' | 'Failed'> = new Map(),
): RawDashboardAddress[] {
  const root = record(response)
  const addressData = record(first(root, 'AddressData', 'addressData', 'addresses', 'data'))
  const statuses = array(txCerResponse)
  const blockedSources = blockedTXCerSourceOutputs(txCerResponse)

  return addresses.map((source) => {
    const state = record(addressData[source.address])
    const value = first(state, 'Value', 'value', 'UTXOValue', 'utxoValue')
    const rawUTXOs = record(first(state, 'UTXO', 'utxos'))
    const exactUTXOs = Object.values(rawUTXOs)
      .map(record)
      .filter((utxo) => {
        const transaction = record(first(utxo, 'UTXO', 'utxo'))
        const position = record(first(utxo, 'Position', 'position'))
        return !blockedSources.has(
          utxoSourceOutputKey(
            first(transaction, 'TXID', 'txID', 'txId'),
            first(position, 'IndexZ', 'indexZ'),
          ),
        )
      })
      .map((utxo) => ({ value: amount(first(utxo, 'Value', 'value')) }))
    const txCers = statuses
      .map(record)
      .filter(
        (status) =>
          String(first(status, 'Address', 'address', 'ToAddress', 'toAddress') ?? '') ===
          source.address,
      )
      .map((status) => ({
        id: String(first(status, 'TXCerID', 'txCerID', 'txcer_id', 'id') ?? ''),
        value: amount(first(status, 'Value', 'value')),
        lifecycle: String(first(status, 'Status', 'status') ?? 'Unknown'),
        fastEvidence:
          credentialStatuses.get(
            String(first(status, 'TXCerID', 'txCerID', 'txcer_id', 'id') ?? ''),
          ) ?? ('Pending' as const),
      }))
    return {
      address: source.address,
      type: source.type,
      utxos:
        Object.keys(rawUTXOs).length > 0
          ? exactUTXOs
          : value == null
            ? []
            : [{ value: amount(value) }],
      txCers,
    }
  })
}

export function normalizeOrganization(response: unknown): OrganizationSummary | undefined {
  const root = record(response)
  const routing = record(first(root, 'Addresstogroup', 'addressToGroup'))
  const candidates = [
    root,
    record(first(root, 'AddressGroup', 'addressGroup', 'AddressData', 'data', 'result')),
    ...Object.values(routing).map(record),
  ]
  for (const candidate of candidates) {
    const id = String(
      first(candidate, 'GuarGroupID', 'guarGroupID', 'GroupID', 'groupID', 'id') ?? '',
    )
    if (id && !['0', '1', 'nogroup'].includes(id.toLowerCase()))
      return {
        id,
        name: String(first(candidate, 'GroupName', 'groupName', 'Name', 'name') ?? id),
        role: String(first(candidate, 'Role', 'role') ?? 'member'),
      }
    for (const value of Object.values(candidate)) {
      const nested = record(value)
      const nestedID = String(
        first(nested, 'GuarGroupID', 'guarGroupID', 'GroupID', 'groupID') ?? '',
      )
      if (nestedID && !['0', '1', 'nogroup'].includes(nestedID.toLowerCase()))
        return { id: nestedID, name: nestedID, role: 'member' }
    }
  }
  return undefined
}

export function normalizeActivities(response: unknown): WalletActivity[] {
  return array(response)
    .slice(0, 20)
    .map((item, index) => {
      const value = record(item)
      return {
        id: String(first(value, 'TXID', 'txID', 'ID', 'id') ?? `activity-${index}`),
        title: String(first(value, 'Title', 'title', 'Type', 'type') ?? '账户更新'),
        amount: amount(first(value, 'Value', 'value', 'Amount', 'amount')),
        coinType: Number(first(value, 'CoinType', 'coinType', 'AssetType', 'assetType') ?? 0),
        asset: String(first(value, 'Symbol', 'symbol', 'Asset', 'asset') ?? ''),
        direction:
          String(first(value, 'Direction', 'direction') ?? '').toLowerCase() === 'out'
            ? 'out'
            : 'in',
        status: String(first(value, 'Status', 'status') ?? '已同步'),
        timestamp: Number(first(value, 'Timestamp', 'timestamp', 'UpdatedAt', 'updatedAt') ?? 0),
      }
    })
}
