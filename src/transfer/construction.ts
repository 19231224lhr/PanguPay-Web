import { normalizeStoredAmount } from '@/protocol-v2/amount'

interface ConstructionInput {
  kind: 'utxo' | 'txcer'
  address?: string
  reference?: string
  outputIndex?: number
  amount?: string
}

interface ConstructionOutput {
  address: string
  amount: string
  coinType?: number
}

export interface TransactionConstruction {
  inputs: ConstructionInput[]
  outputs: ConstructionOutput[]
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function entries(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(record) : []
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() || undefined : undefined
}

function index(value: unknown): number | undefined {
  if (typeof value === 'string' && !/^\d+$/.test(value)) return undefined
  if (typeof value !== 'number' && typeof value !== 'string') return undefined
  const converted = Number(value)
  return Number.isSafeInteger(converted) && converted >= 0 ? converted : undefined
}

function amount(value: unknown): string | undefined {
  try {
    return normalizeStoredAmount(value)
  } catch {
    return undefined
  }
}

/** Project the fields needed for the activity ledger. Never persist raw signing material. */
export function readTransactionConstruction(
  value: unknown,
  selectedUTXOAmounts: readonly string[] = [],
): TransactionConstruction | undefined {
  const tx = record(value)
  const normal = entries(tx.TXInputsNormal ?? tx.txInputsNormal)
  const certificates = entries(tx.TXInputsCertificate ?? tx.txInputsCertificate)
  const inputs: ConstructionInput[] = [
    ...normal.map((input, i): ConstructionInput => ({
      kind: 'utxo',
      address: text(input.FromAddress),
      reference: text(input.FromTXID),
      outputIndex: index(record(input.FromTxPosition).IndexZ),
      amount: amount(selectedUTXOAmounts[i]),
    })),
    ...certificates.map((input): ConstructionInput => ({
      kind: 'txcer',
      address: text(input.ToAddress),
      reference: text(input.TXCerID),
      amount: amount(input.Value),
    })),
  ]
  const outputs = entries(tx.TXOutputs ?? tx.txOutputs).flatMap((output) => {
    const address = text(output.ToAddress)
    const value = amount(output.ToValue)
    return address && value != null
      ? [{ address, amount: value, coinType: index(output.Type) }]
      : []
  })
  return inputs.length || outputs.length ? { inputs, outputs } : undefined
}
