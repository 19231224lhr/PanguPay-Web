export interface GQNCStatusView {
  protocolVersion: string
  enabled: boolean
  validatorCount: number
  quorum: number
  certifiedHeight: number
  currentView: number
  proposerId: string
  latestQCId: string
  safetyStatus: string
  safetyReason: string
}

export interface GQNCBlockView {
  height: number
  hash: string
  proposerId: string
  proposalId: string
  timestamp: number
  transactionCount: number
  transactionIds: string[]
  qcId: string
  qcThreshold: number
  qcSigners: string[]
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function unwrap(value: unknown, keys: string[]): Record<string, unknown> {
  let current = object(value)
  for (const key of keys) {
    const nested = object(current[key])
    if (Object.keys(nested).length) current = nested
  }
  return current
}

function number(value: unknown): number {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0
}

function string(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value)
}

function transactionIds(value: unknown, output = new Set<string>()): string[] {
  if (Array.isArray(value)) {
    for (const item of value) transactionIds(item, output)
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (/^tx_?id$/i.test(key) && typeof item === 'string' && /^[0-9a-f]{64}$/i.test(item))
        output.add(item.toLowerCase())
      else transactionIds(item, output)
    }
  }
  return [...output]
}

export function normalizeGQNCStatus(value: unknown): GQNCStatusView {
  const status = unwrap(value, ['data', 'result', 'status'])
  return {
    protocolVersion: string(status.protocolVersion),
    enabled: Boolean(status.enabled),
    validatorCount: number(status.validatorCount),
    quorum: number(status.quorum),
    certifiedHeight: number(status.certifiedHeight),
    currentView: number(status.currentView),
    proposerId: string(status.proposerID),
    latestQCId: string(status.latestQCID),
    safetyStatus: string(status.safetyStatus),
    safetyReason: string(status.safetyReason),
  }
}

export function normalizeGQNCBlock(value: unknown): GQNCBlockView {
  const envelope = unwrap(value, ['data', 'result', 'envelope'])
  const proposal = object(envelope.Proposal)
  const block = object(envelope.Block)
  const head = object(block.BlockHead ?? block.Head)
  const body = object(block.BlockBody ?? block.Body)
  const qc = object(envelope.QC)
  const ids = transactionIds(body.Transactions ?? body)
  const signers = Array.isArray(qc.Signers) ? qc.Signers.map(string).filter(Boolean) : []
  return {
    height: number(head.BlockHeight),
    hash: string(head.BlockHash),
    proposerId: string(proposal.ProposerID ?? head.BlockProducerID),
    proposalId: string(proposal.ProposalID),
    timestamp: number(head.Timestamp ?? proposal.Timestamp),
    transactionCount: number(head.TXNum) || ids.length,
    transactionIds: ids,
    qcId: string(qc.QCID),
    qcThreshold: number(qc.Threshold),
    qcSigners: signers,
  }
}

export function recentCertifiedHeights(tip: number, limit = 12): number[] {
  if (!Number.isSafeInteger(tip) || tip < 0 || limit <= 0) return []
  return Array.from({ length: Math.min(limit, tip + 1) }, (_, index) => tip - index)
}
