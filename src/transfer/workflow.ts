import type { BuiltTransferTransaction } from './builder'
import { GatewayRequestError } from '@/services/gatewayClient'

type UnknownRecord = Record<string, unknown>

export interface TransferSubmissionGateway {
  submitAssignTransaction(groupID: string, message: unknown): Promise<unknown>
  submitNoGroupTransaction(message: unknown): Promise<unknown>
}

export interface TransferSubmissionReceipt {
  accepted: true
  txID: string
  response: unknown
}

export interface TransferSubmissionOptions {
  beforeRetailSubmit?: () => Promise<void>
}

export type AssignTransactionState = 'accepted' | 'pending' | { failed: string }

export class TransferSubmissionRejectedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TransferSubmissionRejectedError'
  }
}

export function isTransferSubmissionRejectedError(
  cause: unknown,
): cause is TransferSubmissionRejectedError {
  return cause instanceof TransferSubmissionRejectedError
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function submissionError(value: UnknownRecord): string {
  return (
    text(value.error_reason) || text(value.error) || text(value.message) || '后端未接受这笔交易。'
  )
}

export function classifyAssignTransactionStatus(value: unknown): AssignTransactionState {
  const body = record(value)
  const status = text(body.status).toLowerCase()
  const scheduler = text(body.scheduler_status).toLowerCase()
  if (
    ['failed', 'error', 'cancelled', 'canceled', 'timeout', 'rejected'].includes(status) ||
    ['failed', 'error', 'cancelled', 'canceled', 'timeout', 'rejected'].includes(scheduler)
  )
    return { failed: submissionError(body) }
  // Assign's success/completed status is emitted by the scheduler after the
  // Aggregation DAG confirms the transaction. It is not a GQNC BlockQC.
  if (body.result === true || ['confirmed', 'success', 'completed'].includes(status))
    return 'accepted'
  if (
    body.receive_result === true ||
    ['queued', 'accepted', 'pending', 'processing', 'received'].includes(status) ||
    ['queued', 'processing', 'pending_confirm'].includes(scheduler)
  )
    return 'accepted'
  return 'pending'
}

function assertSubmissionAccepted(response: unknown): void {
  const body = record(response)
  if (body.success === false || body.result === false)
    throw new TransferSubmissionRejectedError(submissionError(body))
  const status = text(body.status).toLowerCase()
  if (['failed', 'rejected', 'error'].includes(status))
    throw new TransferSubmissionRejectedError(submissionError(body))
  if (
    body.success !== true &&
    body.result !== true &&
    body.receive_result !== true &&
    !['queued', 'accepted', 'pending', 'processing', 'received', 'success', 'completed'].includes(
      status,
    )
  )
    throw new TransferSubmissionRejectedError('后端响应没有确认已接收交易。')
}

export function gqncCertifiedHeight(value: unknown): number {
  const root = record(value)
  const status = record(root.status)
  const height = Number(status.certifiedHeight ?? status.certified_height ?? 0)
  return Number.isSafeInteger(height) && height > 0 ? height : 0
}

export function hasObservedGQNCCertification(txID: string, value: unknown): boolean {
  const expected = txID.trim().toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(expected)) return false
  const root = record(value)
  const envelope = record(root.envelope ?? root.Envelope)
  const qc = record(envelope.QC ?? envelope.qc)
  const threshold = Number(qc.Threshold ?? qc.threshold ?? 0)
  const signerValue = qc.Signers ?? qc.signers
  const signers: unknown[] = Array.isArray(signerValue) ? signerValue : []
  const qcID = text(qc.QCID ?? qc.qcID ?? qc.qc_id).toLowerCase()
  if (
    threshold !== 3 ||
    new Set(signers.map(String)).size < threshold ||
    !/^[0-9a-f]{64}$/.test(qcID)
  )
    return false
  const block = record(envelope.Block ?? envelope.block)
  const body = record(block.Body ?? block.body)
  const transactions = body.Transactions ?? body.transactions
  if (!Array.isArray(transactions)) return false
  return transactions.some((item) => {
    const aggregate = record(record(item).AggregateTX ?? record(item).aggregateTX)
    const all = aggregate.AllTransactions ?? aggregate.allTransactions
    return (
      Array.isArray(all) &&
      all.some(
        (transaction) =>
          text(record(transaction).TXID ?? record(transaction).txID).toLowerCase() === expected,
      )
    )
  })
}

export async function submitBuiltTransfer(
  gateway: TransferSubmissionGateway,
  built: BuiltTransferTransaction,
  options: TransferSubmissionOptions = {},
): Promise<TransferSubmissionReceipt> {
  let response: unknown
  try {
    if (built.submission.kind === 'retail') await options.beforeRetailSubmit?.()
    response =
      built.submission.kind === 'retail'
        ? await gateway.submitNoGroupTransaction(built.submission.body)
        : await gateway.submitAssignTransaction(built.submission.groupID, built.submission.body)
  } catch (cause) {
    if (cause instanceof GatewayRequestError)
      throw new TransferSubmissionRejectedError(
        submissionError(record(cause.body)) || cause.message,
      )
    throw cause
  }
  assertSubmissionAccepted(response)
  return { accepted: true, txID: built.txID, response }
}
