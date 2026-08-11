import { parseAmount } from '@/protocol-v2/amount'

import type { TransferProgress } from './journal'

export type CrossChainTransferState =
  | 'LOCAL_CERTIFIED'
  | 'PREPARED'
  | 'RETRYING'
  | 'LIGHT_ACCEPTED'
  | 'TARGET_CONFIRMED'
  | 'NEEDS_RECOVERY'

export interface CrossChainTransferStatus {
  txID: string
  verifyHash: string
  state: CrossChainTransferState
  certifiedHeight: number
  qcID: string
  targetAddress: string
  amount: string
  lightTxHash?: string
  targetBlock?: number
  acceptedAt?: number
  confirmedAt?: number
  attempts: number
  lastError?: string
}

type UnknownRecord = Record<string, unknown>

const states = new Set<CrossChainTransferState>([
  'LOCAL_CERTIFIED',
  'PREPARED',
  'RETRYING',
  'LIGHT_ACCEPTED',
  'TARGET_CONFIRMED',
  'NEEDS_RECOVERY',
])

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function integer(value: unknown, allowZero = false): number | undefined {
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1)) return undefined
  return parsed
}

function optionalInteger(value: unknown): number | undefined {
  if (value == null || value === '' || Number(value) === 0) return undefined
  return integer(value)
}

/** Parses only the public, authority-backed cross-chain delivery DTO. */
export function parseCrossChainTransferStatus(value: unknown): CrossChainTransferStatus {
  const body = record(value)
  const transfer = record(body.transfer)
  const state = text(transfer.state) as CrossChainTransferState
  const status: CrossChainTransferStatus = {
    txID: text(transfer.txID).toLowerCase(),
    verifyHash: text(transfer.verifyHash).toLowerCase(),
    state,
    certifiedHeight: integer(transfer.certifiedHeight) ?? 0,
    qcID: text(transfer.qcID).toLowerCase(),
    targetAddress: text(transfer.targetAddress),
    amount: text(transfer.amount),
    lightTxHash: text(transfer.lightTxHash) || undefined,
    targetBlock: optionalInteger(transfer.targetBlock),
    acceptedAt: optionalInteger(transfer.acceptedAt),
    confirmedAt: optionalInteger(transfer.confirmedAt),
    attempts: integer(transfer.attempts, true) ?? -1,
    lastError: text(transfer.lastError) || undefined,
  }
  if (body.success !== true) throw new Error('cross-chain status is not authoritative')
  if (!states.has(state)) throw new Error('unknown cross-chain transfer state')
  if (!/^[0-9a-f]{64}$/.test(status.txID) || status.verifyHash !== status.txID)
    throw new Error('invalid cross-chain transfer identity')
  if (!/^[0-9a-f]{64}$/.test(status.qcID) || status.certifiedHeight < 1)
    throw new Error('invalid cross-chain certification')
  if (!/^0x[0-9a-f]{40}$/i.test(status.targetAddress) || parseAmount(status.amount) <= 0n)
    throw new Error('invalid cross-chain target')
  if (status.attempts < 0) throw new Error('invalid cross-chain attempt count')
  if (status.lightTxHash && !/^0x[0-9a-f]{64}$/i.test(status.lightTxHash))
    throw new Error('invalid light transaction hash')
  if (state === 'LIGHT_ACCEPTED' && (!status.lightTxHash || !status.acceptedAt))
    throw new Error('incomplete light acceptance')
  if (
    state === 'TARGET_CONFIRMED' &&
    (!status.lightTxHash || !status.acceptedAt || !status.confirmedAt || !status.targetBlock)
  )
    throw new Error('incomplete target confirmation')
  if (state === 'NEEDS_RECOVERY' && !status.lastError)
    throw new Error('cross-chain recovery reason is missing')
  return status
}

export type CrossChainProgressUpdate = Pick<TransferProgress, 'phase' | 'updatedAt'> &
  Partial<Omit<TransferProgress, 'phase' | 'updatedAt'>>

/** Maps backend delivery state without treating local certification as target finality. */
export function crossChainProgressUpdate(
  status: CrossChainTransferStatus,
  observedAt: number,
): CrossChainProgressUpdate {
  const common: CrossChainProgressUpdate = {
    phase: 'local-certified',
    certifiedHeight: status.certifiedHeight,
    qcID: status.qcID,
    lightTxHash: status.lightTxHash,
    targetBlock: status.targetBlock,
    targetAcceptedAt: status.acceptedAt,
    targetConfirmedAt: status.confirmedAt,
    crossChainError: status.state === 'NEEDS_RECOVERY' ? status.lastError : undefined,
    updatedAt: observedAt,
  }
  if (status.state === 'TARGET_CONFIRMED') {
    common.phase = 'settled'
    common.settledAt = status.confirmedAt
  } else if (status.state === 'LIGHT_ACCEPTED') {
    common.phase = 'target-accepted'
  }
  return common
}
