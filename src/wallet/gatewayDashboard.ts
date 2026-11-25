import { addAmounts, canonicalAmount } from '@/protocol-v2/amount'
import type { TXCerIssuanceRecordV2 } from '@/protocol-v2/types'
import type { RawDashboardAddress } from '@/wallet/dashboard'
import { blockedTXCerSourceOutputs, utxoSourceOutputKey } from '@/wallet/txcerLifecycle'
import type { OrganizationSummary, WalletActivity, WalletCredentialSummary } from '@/wallet/types'

import { certifiedGQNCTransactions } from '@/transfer/workflow'
import { readTransactionConstruction } from '@/transfer/construction'

type UnknownRecord = Record<string, unknown>
const chainEpoch = Date.UTC(2020, 0, 1)

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

export function normalizeActivities(
  response: unknown,
  addresses: ReadonlySet<string>,
): WalletActivity[] {
  const updates = record(response).updates
  if (Array.isArray(updates)) {
    return updates.flatMap((item) => {
      const update = record(item)
      const incoming = record(record(update.WalletChangeData).In)
      const incomingUTXOs = Object.entries(incoming)
        .filter(([address]) => addresses.has(address.toLowerCase()))
        .flatMap(([, values]) => array(values).map((value) => record(value).UTXOData))
      const spentTXCerUTXOs = array(update.UsedTXCerChangeData).map((value) => record(value).UTXO)
      return [...incomingUTXOs, ...spentTXCerUTXOs].flatMap((value) => {
        const utxo = record(value)
        return receiveActivity(
          record(utxo.UTXO),
          Number(utxo.Time ?? update.Timestamp ?? 0),
          addresses,
        )
      })
    })
  }

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

export function spendReadyReceiveActivities(
  records: TXCerIssuanceRecordV2[],
  credentials: ReadonlyArray<
    Pick<WalletCredentialSummary, 'txCerId' | 'lifecycle' | 'fastEvidenceStatus'>
  >,
  lifecycleResponse: unknown,
  account: {
    id: string
    organizationId: string
    addresses: ReadonlySet<string>
    activeAddresses: ReadonlySet<string>
  },
): WalletActivity[] {
  const verified = new Set(
    credentials
      .filter((item) => item.lifecycle === 'Active' && item.fastEvidenceStatus === 'Verified')
      .map((item) => item.txCerId),
  )
  const statuses = new Map(
    array(lifecycleResponse)
      .map(record)
      .map((item) => [first(item, 'txCerID', 'TXCerID'), item]),
  )
  const results = new Map<string, WalletActivity>()
  const outputs = new Set<string>()
  for (const item of records) {
    const id = String(item.TXID ?? '').toLowerCase()
    const address = String(item.ToAddress ?? '').toLowerCase()
    const state = statuses.get(item.TXCerID)
    const certificate = item.TXCer
    const ack = record(item.Ack)
    if (
      !state ||
      first(state, 'status', 'Status') !== 'Active' ||
      !verified.has(item.TXCerID ?? '') ||
      !/^[0-9a-f]{64}$/.test(id) ||
      !account.activeAddresses.has(address) ||
      item.UserID !== account.id ||
      certificate?.ToGuarGroupID !== account.organizationId ||
      first(state, 'userID', 'UserID') !== account.id ||
      String(first(state, 'address', 'Address') ?? '').toLowerCase() !== address ||
      String(first(state, 'sourceTXID', 'SourceTXID') ?? '').toLowerCase() !== id ||
      first(ack, 'groupID', 'GroupID') !== account.organizationId ||
      first(ack, 'userID', 'UserID') !== account.id ||
      first(ack, 'status', 'Status') !== 'RegisteredActive'
    )
      continue

    // Schema v2 reserves the input addresses for both UTXOs and TXCers.
    const inputs = array(item.FastEvidence?.Reservation?.SoftKeys)
      .filter((key): key is string => typeof key === 'string' && key.startsWith('address_spend:'))
      .map((key) => key.slice('address_spend:'.length).toLowerCase())
      .filter(Boolean)
    if (!inputs.length || inputs.some((input) => account.addresses.has(input))) continue

    const value = amount(certificate.Value)
    if (value === '0' || value !== amount(first(state, 'value', 'Value'))) continue
    const registeredAt = Number(first(ack, 'registeredAt', 'RegisteredAt'))
    if (!Number.isSafeInteger(registeredAt) || registeredAt <= 0) continue
    const timestamp = chainEpoch + registeredAt * 1_000
    if (timestamp > 8.64e15) continue
    const output = `${id}:${item.OutputIndex}`
    if (outputs.has(output)) continue
    outputs.add(output)

    const previous = results.get(id)
    results.set(id, {
      id,
      title: '转入',
      amount: addAmounts(previous?.amount ?? '0', value),
      coinType: 0,
      direction: 'in',
      status: 'spend-ready',
      timestamp: Math.min(previous?.timestamp ?? timestamp, timestamp),
    })
  }
  return [...results.values()]
}

export function certifiedReceiveActivities(
  response: unknown,
  timestamp: number,
  addresses: ReadonlySet<string>,
): WalletActivity[] {
  return certifiedGQNCTransactions(response).flatMap((transaction) =>
    receiveActivity(transaction, timestamp, addresses),
  )
}

function receiveActivity(
  transaction: UnknownRecord,
  timestamp: number,
  addresses: ReadonlySet<string>,
): WalletActivity[] {
  const id = String(transaction.TXID ?? transaction.txID ?? '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(id)) return []
  const normalInputs = array(transaction.TXInputsNormal).map(record)
  const certificates = array(transaction.TXInputsCertificate).map(record)
  // A transaction spending this wallet's inputs is represented by its outgoing activity.
  if (
    normalInputs.some((input) => addresses.has(String(input.FromAddress).toLowerCase())) ||
    certificates.some((input) => addresses.has(String(input.ToAddress).toLowerCase()))
  )
    return []
  const outputs = array(transaction.TXOutputs)
    .map(record)
    .filter(
      (output) =>
        addresses.has(String(output.ToAddress).toLowerCase()) &&
        !output.IsPayForGas &&
        !output.IsCrossChain &&
        !output.IsGuarMake,
    )
  if (!outputs.length) return []
  const total = addAmounts(...outputs.map((output) => amount(output.ToValue)))
  if (total === '0') return []
  return [
    {
      id,
      title: '转入',
      amount: total,
      coinType: Number(outputs[0]?.Type ?? 0),
      direction: 'in',
      status: 'settled',
      timestamp: chainEpoch + timestamp * 1_000,
      construction: readTransactionConstruction(transaction),
    },
  ]
}

export function mergeWalletActivities(...feeds: WalletActivity[][]): WalletActivity[] {
  const merged = new Map<string, WalletActivity>()
  for (const item of feeds.flat()) {
    const current = merged.get(item.id)
    if (current?.status === 'settled' && item.status !== 'settled') continue
    if (current?.status === 'spend-ready' && !['spend-ready', 'settled'].includes(item.status)) continue
    merged.set(
      item.id,
      current?.status === 'spend-ready' || current?.status === 'settled'
        ? {
            ...item,
            timestamp: Math.min(current.timestamp, item.timestamp),
            construction: item.construction ?? current.construction,
          }
        : item,
    )
  }
  return [...merged.values()].sort((left, right) => right.timestamp - left.timestamp).slice(0, 100)
}
