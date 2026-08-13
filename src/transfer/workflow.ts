import type { BuiltTransferTransaction } from './builder'
import { GatewayRequestError } from '@/services/gatewayClient'
import type { TransferDAGReceipt, TransferProgress } from './journal'

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

export type AssignTransactionState = 'accepted' | 'spend-ready' | 'pending' | { failed: string }

export interface AssignBackendTiming {
  acceptedAt?: number
  spendReadyAt?: number
}

const schedulerFailureEvents = new Set(['verify_failed', 'aggr_failed', 'timeout', 'rejected'])

export interface TransferTimelineItem {
  id?: string
  label: string
  detail?: string
  meta?: string
  state: 'complete' | 'active' | 'pending' | 'error'
}

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
  // Assign only reports success after Aggregation has confirmed that every
  // issued TXCer was atomically registered with a matching AssignAck. This is
  // recipient spend-readiness, not a GQNC BlockQC.
  if (
    body.result === true ||
    ['confirmed', 'success', 'completed'].includes(status) ||
    ['confirmed', 'success', 'completed'].includes(scheduler)
  )
    return 'spend-ready'
  if (
    body.receive_result === true ||
    ['queued', 'accepted', 'pending', 'processing', 'received'].includes(status) ||
    ['queued', 'processing', 'pending_confirm'].includes(scheduler)
  )
    return 'accepted'
  return 'pending'
}

export function parseAssignBackendTiming(value: unknown): AssignBackendTiming {
  const body = record(value)
  const acceptedAt = Number(body.accepted_at_unix_ms)
  const spendReadyAt = Number(body.spend_ready_at_unix_ms)
  if (!Number.isSafeInteger(acceptedAt) || acceptedAt <= 0) return {}
  if (!Number.isSafeInteger(spendReadyAt) || spendReadyAt <= 0) return { acceptedAt }
  if (spendReadyAt < acceptedAt) return {}
  return { acceptedAt, spendReadyAt }
}

function integer(value: unknown): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

export function parseSchedulerDAGReceipts(value: unknown): TransferDAGReceipt[] {
  const body = record(value)
  const rawEvents = body.events ?? body.Events
  if (!Array.isArray(rawEvents)) return []
  const byIdentity = new Map<string, TransferDAGReceipt>()
  for (const rawEvent of rawEvents) {
    const event = record(rawEvent)
    const seq = integer(event.Seq ?? event.seq)
    const eventType = text(event.EventType ?? event.eventType ?? event.event_type).toLowerCase()
    const toStatus = text(event.ToStatus ?? event.toStatus ?? event.to_status).toLowerCase()
    if (seq < 1 || !eventType || !toStatus) continue
    const eventID = text(event.EventID ?? event.eventID ?? event.event_id)
    const receipt: TransferDAGReceipt = {
      eventID: eventID || `seq:${seq}`,
      seq,
      eventType,
      nodeRole: text(
        event.SourceNodeRole ?? event.sourceNodeRole ?? event.NodeRole ?? event.nodeRole,
      ).toLowerCase(),
      nodeID: text(event.SourceNodeID ?? event.sourceNodeID ?? event.NodeID ?? event.nodeID),
      fromStatus: text(event.FromStatus ?? event.fromStatus ?? event.from_status).toLowerCase(),
      toStatus,
      reason: text(event.Reason ?? event.reason),
      timestamp: integer(event.Timestamp ?? event.timestamp) || undefined,
    }
    byIdentity.set(receipt.eventID, receipt)
  }
  return [...byIdentity.values()].sort((left, right) => left.seq - right.seq)
}

export function mergeSchedulerDAGReceipts(
  current: TransferDAGReceipt[] = [],
  incoming: TransferDAGReceipt[] = [],
): TransferDAGReceipt[] {
  const merged = new Map<string, TransferDAGReceipt>()
  for (const receipt of [...current, ...incoming]) {
    if (!receipt.eventID || !Number.isSafeInteger(receipt.seq) || receipt.seq < 1) continue
    merged.set(receipt.eventID, receipt)
  }
  return [...merged.values()].sort((left, right) => left.seq - right.seq).slice(-100)
}

export function schedulerDAGFailure(receipts: TransferDAGReceipt[]): string | undefined {
  const failed = [...receipts]
    .reverse()
    .find((receipt) => schedulerFailureEvents.has(receipt.eventType))
  if (!failed) return undefined
  return failed.reason || `担保组织内部处理失败（${failed.eventType}）。`
}

function durationLabel(elapsed?: number): string | undefined {
  if (!Number.isFinite(elapsed) || elapsed == null || elapsed < 0) return undefined
  if (elapsed < 1) return '< 1 ms'
  if (elapsed < 1_000) return `${Math.round(elapsed)} ms`
  if (elapsed < 10_000) return `${(elapsed / 1_000).toFixed(2)} s`
  return `${(elapsed / 1_000).toFixed(1)} s`
}

function observedDuration(startedAt?: number, completedAt?: number): string | undefined {
  if (!startedAt || !completedAt) return undefined
  const elapsed = completedAt - startedAt
  if (elapsed < 0) return undefined
  return durationLabel(elapsed)
}

function shortHash(value?: string): string | undefined {
  if (!value) return undefined
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function buildCrossChainTimeline(progress: TransferProgress): TransferTimelineItem[] {
  const receipts = progress.dagReceipts ?? []
  const events = new Set(receipts.map((receipt) => receipt.eventType))
  const failure = [...receipts]
    .reverse()
    .find((receipt) => schedulerFailureEvents.has(receipt.eventType))
  const failed = progress.phase === 'failed'
  const accepted =
    Boolean(progress.acceptedAt) ||
    ['accepted', 'spend-ready', 'local-certified', 'target-accepted', 'settled'].includes(
      progress.phase,
    ) ||
    receipts.length > 0
  const localCertified =
    Boolean(progress.certifiedHeight) ||
    ['local-certified', 'target-accepted', 'settled'].includes(progress.phase)
  const guaranteeComplete =
    events.has('verify_passed') || events.has('aggr_confirmed') || localCertified
  const guaranteeStarted =
    events.has('dispatched') || events.has('guar_received') || events.has('verify_started')
  const lightAccepted =
    Boolean(progress.lightTxHash) &&
    (Boolean(progress.targetAcceptedAt) || ['target-accepted', 'settled'].includes(progress.phase))
  const targetConfirmed =
    progress.phase === 'settled' &&
    Boolean(progress.targetBlock) &&
    Boolean(progress.targetConfirmedAt)
  const lightHash = shortHash(progress.lightTxHash)
  const total = observedDuration(progress.acceptedAt, progress.targetConfirmedAt)
  const targetMeta = targetConfirmed
    ? [`区块 ${progress.targetBlock}`, total ? `跨链总耗时 ${total}` : '']
        .filter(Boolean)
        .join(' · ')
    : undefined

  return [
    {
      id: 'received',
      label: '跨链交易已接收',
      detail: accepted ? '交易与签名已通过源区入口校验。' : '正在提交跨链交易。',
      state: failed ? 'error' : accepted ? 'complete' : 'active',
    },
    {
      id: 'guarantee',
      label: '担保验证',
      detail: failure
        ? failure.reason || '担保组织拒绝了这笔跨链交易。'
        : guaranteeComplete
          ? '担保节点已完成跨链约束验证。'
          : '正在验证输入、签名与跨链约束。',
      state: failure
        ? 'error'
        : guaranteeComplete
          ? 'complete'
          : guaranteeStarted
            ? 'active'
            : 'pending',
    },
    {
      id: 'local-certified',
      label: '本地 GQNC 已认证',
      detail: localCertified
        ? '源区交易已经终局认证，正在提交轻计算区。'
        : '等待源区 GQNC 完成 3-of-4 认证。',
      meta: progress.certifiedHeight ? `认证高度 ${progress.certifiedHeight}` : undefined,
      state: progress.crossChainError
        ? 'error'
        : localCertified
          ? 'complete'
          : guaranteeComplete
            ? 'active'
            : 'pending',
    },
    {
      id: 'target-accepted',
      label: '轻计算区已接收',
      detail: progress.crossChainError
        ? `跨链投递需要人工恢复：${progress.crossChainError}`
        : lightAccepted
          ? '轻计算区交易池已接收，正在等待目标链出块。'
          : '等待轻计算区确认接收。',
      meta: lightAccepted ? lightHash : undefined,
      state: progress.crossChainError
        ? 'error'
        : lightAccepted
          ? 'complete'
          : localCertified
            ? 'active'
            : 'pending',
    },
    {
      id: 'target-confirmed',
      label: '目标链到账',
      detail: targetConfirmed
        ? '目标链回执成功，跨链到账完成。'
        : lightAccepted
          ? '等待目标链将交易写入区块。'
          : '等待轻计算区接收交易。',
      meta: targetMeta,
      state: progress.crossChainError
        ? 'error'
        : targetConfirmed
          ? 'complete'
          : lightAccepted
            ? 'active'
            : 'pending',
    },
  ]
}

export function buildTransferTimeline(progress?: TransferProgress): TransferTimelineItem[] {
  if (progress?.mode === 'cross') return buildCrossChainTimeline(progress)
  const receipts = progress?.dagReceipts ?? []
  const events = new Set(receipts.map((receipt) => receipt.eventType))
  const failure = [...receipts]
    .reverse()
    .find((receipt) => schedulerFailureEvents.has(receipt.eventType))
  const failed = progress?.phase === 'failed'
  const accepted =
    Boolean(progress?.acceptedAt) ||
    Boolean(
      progress &&
      ['accepted', 'spend-ready', 'local-certified', 'target-accepted', 'settled'].includes(
        progress.phase,
      ),
    ) ||
    receipts.length > 0
  const guaranteeStarted =
    events.has('dispatched') ||
    events.has('guar_received') ||
    events.has('verify_started') ||
    events.has('verify_passed')
  const guaranteeComplete =
    events.has('verify_passed') ||
    events.has('aggr_confirmed') ||
    Boolean(progress?.spendReadyAt) ||
    Boolean(progress?.settledAt)
  const organizationComplete =
    events.has('aggr_confirmed') || Boolean(progress?.spendReadyAt) || Boolean(progress?.settledAt)
  const spendReady = Boolean(progress?.spendReadyAt) || progress?.phase === 'spend-ready'
  const settled = Boolean(progress?.settledAt) || progress?.phase === 'settled'
  const guaranteeFailed = failure?.eventType === 'verify_failed'
  const organizationFailed =
    failure?.eventType === 'aggr_failed' ||
    failure?.eventType === 'timeout' ||
    failure?.eventType === 'rejected'
  const isQuick = progress?.mode === 'quick'
  const backendSpendReadyDuration = observedDuration(
    progress?.backendAcceptedAt,
    progress?.backendSpendReadyAt,
  )
  const spendReadyTiming = backendSpendReadyDuration
    ? `可用耗时 ${backendSpendReadyDuration}`
    : undefined
  const settlementDuration = durationLabel(progress?.backendConsensusMillis)
  const settlementTiming = settlementDuration ? `结算耗时 ${settlementDuration}` : undefined

  return [
    {
      id: 'received',
      label: '交易已接收',
      detail: accepted ? '交易与签名已通过入口校验。' : '正在提交交易。',
      state: accepted ? 'complete' : failed ? 'error' : 'active',
    },
    {
      id: 'guarantee',
      label: '担保验证',
      detail: guaranteeFailed
        ? failure?.reason || '担保节点拒绝了这笔交易。'
        : guaranteeComplete
          ? '担保节点已完成安全验证。'
          : '正在验证输入、签名与担保约束。',
      state: guaranteeFailed
        ? 'error'
        : guaranteeComplete
          ? 'complete'
          : guaranteeStarted
            ? 'active'
            : 'pending',
    },
    {
      id: 'organization',
      label: '组织确认',
      detail: organizationFailed
        ? failure?.reason || '担保组织未能完成确认。'
        : organizationComplete
          ? '担保组织已确认并登记处理结果。'
          : guaranteeComplete
            ? '担保验证已通过，正在完成组织确认。'
            : '等待担保验证完成。',
      state: organizationFailed
        ? 'error'
        : organizationComplete
          ? 'complete'
          : guaranteeComplete
            ? 'active'
            : 'pending',
    },
    {
      id: 'recipient-ready',
      label: isQuick ? '收款方可用' : '收款方到账',
      detail: isQuick
        ? spendReady
          ? 'TXCer 已完成原子登记，收款方现在即可再次支付。'
          : '等待收款方完成到账登记。'
        : settled
          ? '交易已结算到收款地址。'
          : '等待后台结算完成。',
      meta: isQuick && spendReady ? spendReadyTiming : undefined,
      state:
        failed && !guaranteeFailed && !organizationFailed
          ? 'error'
          : isQuick
            ? spendReady
              ? 'complete'
              : organizationComplete
                ? 'active'
                : 'pending'
            : settled
              ? 'complete'
              : organizationComplete
                ? 'active'
                : 'pending',
    },
    {
      id: 'settlement',
      label: '后台结算',
      detail: settled ? '交易已获得 GQNC 认证并完成结算。' : 'GQNC 在后台认证，不阻塞快速可用。',
      meta: settled ? settlementTiming : undefined,
      state:
        failed && !failure ? 'error' : settled ? 'complete' : spendReady ? 'active' : 'pending',
    },
  ]
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

export function gqncConsensusMillisAtHeight(value: unknown, height: number): number | undefined {
  if (!Number.isSafeInteger(height) || height < 1) return undefined
  const samples = record(value).samples
  if (!Array.isArray(samples)) return undefined
  let selected: { certifiedAt: number; millis: number } | undefined
  for (const rawSample of samples) {
    const sample = record(rawSample)
    if (Number(sample.height) !== height) continue
    const millis = Number(sample.consensusMillis)
    const certifiedAt = Number(sample.certifiedAtUnixNano)
    if (!Number.isFinite(millis) || millis < 0 || !Number.isFinite(certifiedAt) || certifiedAt <= 0)
      continue
    if (!selected || certifiedAt > selected.certifiedAt) selected = { certifiedAt, millis }
  }
  return selected?.millis
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
