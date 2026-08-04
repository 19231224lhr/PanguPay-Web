import type { TransferMode } from './core'

export type TransferPhase =
  'review' | 'submitting' | 'accepted' | 'spend-ready' | 'settled' | 'failed'

export interface TransferDAGReceipt {
  eventID: string
  seq: number
  eventType: string
  nodeRole: string
  nodeID?: string
  fromStatus?: string
  toStatus: string
  reason?: string
  timestamp?: number
}

export interface TransferProgress {
  draftID: string
  txID: string
  mode: TransferMode
  amount: string
  recipient: string
  inputIDs?: string[]
  groupID?: string
  submissionKind?: 'assign' | 'retail'
  coinType?: number
  phase: TransferPhase
  error?: string
  acceptedAt?: number
  spendReadyAt?: number
  settledAt?: number
  dagReceipts?: TransferDAGReceipt[]
  updatedAt: number
}

type TransferProgressUpdate =
  | TransferProgress
  | (Pick<TransferProgress, 'draftID' | 'phase' | 'updatedAt'> &
      Partial<Omit<TransferProgress, 'draftID' | 'phase' | 'updatedAt'>>)

const rank: Record<Exclude<TransferPhase, 'failed'>, number> = {
  review: 0,
  submitting: 1,
  accepted: 2,
  'spend-ready': 3,
  settled: 4,
}

function key(accountID: string): string {
  if (!accountID.trim()) throw new Error('account ID is required')
  return `pangupay-transfer-journal:${accountID}`
}

export function loadTransferJournal(accountID: string): TransferProgress[] {
  const raw = localStorage.getItem(key(accountID))
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) throw new Error()
    return value as TransferProgress[]
  } catch {
    throw new Error('transfer journal is damaged')
  }
}

export function clearTransferJournal(accountID: string): void {
  localStorage.removeItem(key(accountID))
}

function hasMonitorContext(progress: TransferProgress): boolean {
  return (
    Array.isArray(progress.inputIDs) &&
    progress.inputIDs.length > 0 &&
    progress.inputIDs.every((id) => typeof id === 'string' && !!id) &&
    new Set(progress.inputIDs).size === progress.inputIDs.length &&
    (progress.submissionKind === 'assign' || progress.submissionKind === 'retail') &&
    Number.isSafeInteger(progress.coinType) &&
    Number(progress.coinType) >= 0 &&
    (progress.submissionKind === 'retail' || !!progress.groupID?.trim())
  )
}

export function loadResumableTransferProgress(accountID: string): TransferProgress[] {
  return loadTransferJournal(accountID).filter(
    (progress) =>
      ['submitting', 'accepted', 'spend-ready'].includes(progress.phase) &&
      hasMonitorContext(progress),
  )
}

export function recordTransferProgress(
  accountID: string,
  update: TransferProgressUpdate,
): TransferProgress {
  const journal = loadTransferJournal(accountID)
  const index = journal.findIndex((item) => item.draftID === update.draftID)
  const current = index >= 0 ? journal[index] : undefined
  if (
    current &&
    current.phase !== 'failed' &&
    update.phase !== 'failed' &&
    rank[update.phase] < rank[current.phase]
  )
    throw new Error('transfer phase regression')
  const next = { ...current, ...update } as TransferProgress
  if (!next.txID || !/^[0-9a-f]{64}$/i.test(next.txID)) throw new Error('transfer TXID is invalid')
  if (!next.mode || !next.amount || !next.recipient)
    throw new Error('transfer journal is incomplete')
  const suppliedMonitorContext =
    next.inputIDs != null ||
    next.groupID != null ||
    next.submissionKind != null ||
    next.coinType != null
  if (suppliedMonitorContext && !hasMonitorContext(next))
    throw new Error('transfer monitor context is incomplete')
  if (update.phase === 'accepted') next.acceptedAt ??= update.updatedAt
  if (update.phase === 'spend-ready') {
    next.acceptedAt ??= update.updatedAt
    next.spendReadyAt ??= update.updatedAt
  }
  if (update.phase === 'settled') {
    next.acceptedAt ??= update.updatedAt
    next.settledAt ??= update.updatedAt
  }
  if (index >= 0) journal[index] = next
  else journal.unshift(next)
  localStorage.setItem(key(accountID), JSON.stringify(journal.slice(0, 100)))
  return next
}
