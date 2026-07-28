type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
}

function first(value: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) if (value[key] != null) return value[key]
  return undefined
}

function lifecycleRecords(response: unknown): UnknownRecord[] {
  if (Array.isArray(response)) return response.map(record)
  const root = record(response)
  for (const key of ['statuses', 'Statuses', 'records', 'items', 'data']) {
    if (Array.isArray(root[key])) return (root[key] as unknown[]).map(record)
  }
  return []
}

export function utxoSourceOutputKey(txID: unknown, outputIndex: unknown): string {
  const id = typeof txID === 'string' ? txID.trim() : ''
  const index =
    typeof outputIndex === 'string' && /^\d+$/.test(outputIndex) ? Number(outputIndex) : outputIndex
  return id && Number.isSafeInteger(index) && Number(index) >= 0 ? `${id}:${index}` : ''
}

export function blockedTXCerSourceOutputs(response: unknown): Set<string> {
  const blocked = new Set<string>()
  for (const status of lifecycleRecords(response)) {
    const lifecycle = String(first(status, 'Status', 'status') ?? '')
    if (!lifecycle || lifecycle === 'ConvertedToUTXO') continue
    const position = record(first(status, 'SourcePosition', 'sourcePosition'))
    const key = utxoSourceOutputKey(
      first(status, 'SourceTXID', 'sourceTXID', 'sourceTxID'),
      first(position, 'InIndex', 'inIndex', 'IndexZ', 'indexZ'),
    )
    if (key) blocked.add(key)
  }
  return blocked
}
