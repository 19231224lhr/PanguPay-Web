export const ACCEPTED_TRANSFER_MONITOR_LIMIT_MS = 10 * 60_000

export type TXCerSpendReadyState = 'pending' | 'registered' | 'spend-ready' | 'failed'

export interface TXCerSpendReadyStatus {
  txID: string
  state: TXCerSpendReadyState
  issuedCount: number
  registeredCount: number
  registeredAt?: number
  spendReadyAt?: number
  lastError: string
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('invalid TXCer spend-ready response')
  return value as Record<string, unknown>
}

function count(value: unknown, field: string): number {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0)
    throw new Error(`invalid TXCer spend-ready ${field}`)
  return parsed
}

export function parseTXCerSpendReadyStatus(value: unknown): TXCerSpendReadyStatus {
  const root = record(value)
  const txID = String(root.tx_id ?? '')
  const rawState = String(root.state ?? '')
  const state = (
    rawState === 'ready' && root.metric_name === 'assign_ack_ready' ? 'registered' : rawState
  ) as TXCerSpendReadyState
  if (!/^[0-9a-f]{64}$/i.test(txID)) throw new Error('invalid TXCer spend-ready TXID')
  if (!['pending', 'registered', 'spend-ready', 'failed'].includes(state))
    throw new Error('invalid TXCer spend-ready state')
  const issuedCount = count(root.issued_count, 'issued count')
  const registeredCount = count(root.registered_count, 'registered count')
  if (registeredCount > issuedCount) throw new Error('invalid TXCer registration count')

  const registeredAt =
    root.assign_ack_ready_at_unix_ms === undefined
      ? undefined
      : Number(root.assign_ack_ready_at_unix_ms)
  if (
    state === 'registered' &&
    (!issuedCount ||
      registeredCount !== issuedCount ||
      !Number.isSafeInteger(registeredAt) ||
      Number(registeredAt) <= 0)
  )
    throw new Error('incomplete TXCer registration evidence')

  const rawReadyAt = root.spend_ready_at_unix_ms
  const spendReadyAt = rawReadyAt === undefined ? undefined : Number(rawReadyAt)
  if (spendReadyAt !== undefined && (!Number.isSafeInteger(spendReadyAt) || spendReadyAt <= 0))
    throw new Error('invalid TXCer spend-ready timestamp')
  if (state === 'spend-ready' && (!issuedCount || registeredCount !== issuedCount || !spendReadyAt))
    throw new Error('incomplete TXCer spend-ready evidence')

  return {
    txID: txID.toLowerCase(),
    state,
    issuedCount,
    registeredCount,
    ...(registeredAt === undefined ? {} : { registeredAt }),
    spendReadyAt,
    lastError: String(root.last_error ?? ''),
  }
}
