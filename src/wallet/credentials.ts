import { canonicalAmount } from '@/protocol-v2/amount'
import { evaluateTXCerSecurity, type TXCerAuthoritySnapshot } from '@/protocol-v2/security'
import type { PublicKeyV2, TXCerIssuanceRecordV2 } from '@/protocol-v2/types'
import type { WalletCredentialSummary, WalletExposureShareSummary } from '@/wallet/types'

type UnknownRecord = Record<string, unknown>

export function isActiveCredentialFailure(
  credential: Pick<WalletCredentialSummary, 'lifecycle' | 'fastEvidenceStatus'>,
): boolean {
  return credential.lifecycle === 'Active' && credential.fastEvidenceStatus === 'Failed'
}

export function isActiveCredentialAuditPending(
  credential: Pick<WalletCredentialSummary, 'lifecycle' | 'cfaaAuditStatus'>,
): boolean {
  return (
    credential.lifecycle === 'Active' &&
    ['Pending', 'Unavailable'].includes(credential.cfaaAuditStatus)
  )
}

function record(value: unknown): UnknownRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as UnknownRecord) : {}
}

function first(value: UnknownRecord, ...keys: string[]): unknown {
  for (const key of keys) if (value[key] != null) return value[key]
  return undefined
}

function list(value: unknown, ...keys: string[]): unknown[] {
  if (Array.isArray(value)) return value
  const root = record(value)
  for (const key of keys) if (Array.isArray(root[key])) return root[key] as unknown[]
  return []
}

function text(value: unknown): string {
  return value == null ? '' : String(value)
}

function publicKey(value: unknown): PublicKeyV2 | undefined {
  const candidate = record(value)
  return first(candidate, 'X', 'x') != null && first(candidate, 'Y', 'y') != null
    ? (candidate as PublicKeyV2)
    : undefined
}

function normalizeRecord(value: unknown): TXCerIssuanceRecordV2 {
  const wrapper = record(value)
  const source = {
    ...record(first(wrapper, 'Record', 'record', 'IssuanceRecord', 'issuanceRecord')),
    ...wrapper,
  }
  return {
    ...source,
    RecordID: text(first(source, 'RecordID', 'recordID')),
    IssueKey: text(first(source, 'IssueKey', 'issueKey')),
    TXID: text(first(source, 'TXID', 'txID')),
    OutputIndex: Number(first(source, 'OutputIndex', 'outputIndex') ?? 0),
    UserID: text(first(source, 'UserID', 'userID')),
    ToAddress: text(first(source, 'ToAddress', 'toAddress')),
    TXCerID: text(first(source, 'TXCerID', 'txCerID')),
    TXCer: (first(wrapper, 'txCer', 'TXCer') ??
      first(source, 'TXCer', 'txCer')) as TXCerIssuanceRecordV2['TXCer'],
    GuarGroupID: text(first(source, 'GuarGroupID', 'guarGroupID')),
    TargetBlock: Number(first(source, 'TargetBlock', 'targetBlock') ?? 0),
    GuarTXIndex: Number(first(source, 'GuarTXIndex', 'guarTXIndex') ?? 0),
    CertifierID: text(first(source, 'CertifierID', 'certifierID')),
    BatchID: text(first(source, 'BatchID', 'batchID')),
    Proof: (first(wrapper, 'proof', 'Proof', 'IssuanceProof', 'issuanceProof') ??
      first(source, 'Proof', 'proof')) as TXCerIssuanceRecordV2['Proof'],
    Ack: (first(wrapper, 'ack', 'Ack') ??
      first(source, 'Ack', 'ack')) as TXCerIssuanceRecordV2['Ack'],
    ExposureSharesHash: first(source, 'ExposureSharesHash', 'exposureSharesHash') as never,
    LiabilityReceiptHash: first(source, 'LiabilityReceiptHash', 'liabilityReceiptHash') as never,
    RootExposureIDs: (first(source, 'RootExposureIDs', 'rootExposureIDs') ?? []) as string[],
    LiabilityDeltaID: text(first(source, 'LiabilityDeltaID', 'liabilityDeltaID')),
    LiabilityReceipt: (first(wrapper, 'liabilityReceipt', 'LiabilityReceipt') ??
      first(
        source,
        'LiabilityReceipt',
        'liabilityReceipt',
      )) as TXCerIssuanceRecordV2['LiabilityReceipt'],
    FastEvidence: (first(wrapper, 'fastEvidence', 'FastEvidence') ??
      first(source, 'FastEvidence', 'fastEvidence')) as TXCerIssuanceRecordV2['FastEvidence'],
    AuditStatus: text(first(source, 'AuditStatus', 'auditStatus')),
  }
}

export function extractIssuanceRecords(response: unknown): TXCerIssuanceRecordV2[] {
  const records = list(response, 'records', 'Records', 'items', 'data')
    .map(normalizeRecord)
    .filter((item) => Boolean(item.RecordID || item.TXCerID))
  const best = new Map<string, TXCerIssuanceRecordV2>()
  const score = (item: TXCerIssuanceRecordV2) =>
    [item.TXCer, item.FastEvidence, item.Ack, item.LiabilityReceipt, item.Proof].filter(Boolean)
      .length
  for (const item of records) {
    const key = text(item.TXCerID || item.RecordID)
    const current = best.get(key)
    if (!current || score(item) >= score(current)) best.set(key, item)
  }
  return [...best.values()].sort((left, right) =>
    text(left.RecordID || left.TXCerID).localeCompare(text(right.RecordID || right.TXCerID)),
  )
}

function deliveryID(value: unknown): string {
  const wrapper = record(value)
  const txCer = record(first(wrapper, 'TXCer', 'txCer'))
  return text(first(txCer, 'TXCerID', 'txCerID') ?? first(wrapper, 'TXCerID', 'txCerID'))
}

function deliveryAddress(value: unknown): string {
  const wrapper = record(value)
  const txCer = record(first(wrapper, 'TXCer', 'txCer'))
  return text(first(wrapper, 'ToAddress', 'toAddress') ?? first(txCer, 'ToAddress', 'toAddress'))
}

export function mergeTXCerDeliveryEnvelopes(
  existing: unknown[],
  response: unknown,
  walletAddresses: string[],
): unknown[] {
  const addresses = new Set(
    walletAddresses.map((item) => item.trim().toLowerCase()).filter(Boolean),
  )
  const result = new Map<string, unknown>()
  for (const item of [...existing, ...list(response, 'txcers', 'TXCers')]) {
    const address = deliveryAddress(item).trim().toLowerCase()
    if (!addresses.has(address)) continue
    const id = deliveryID(item)
    if (!/^[0-9a-f]{64}$/i.test(id)) throw new Error('received TXCer identity is invalid')
    result.set(id.toLowerCase(), structuredClone(item))
  }
  return [...result.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value)
}

export function mergeTXCerIssuanceResponses(...responses: unknown[]): { records: unknown[] } {
  const records: unknown[] = []
  for (const response of responses) {
    records.push(...list(response, 'records', 'Records', 'items', 'data'))
    records.push(...list(response, 'txcers', 'TXCers'))
    if (Array.isArray(response)) records.push(...response)
  }
  return { records: extractIssuanceRecords({ records }) }
}

export function credentialGroupIDs(records: TXCerIssuanceRecordV2[]): string[] {
  const ids = new Set<string>()
  for (const item of records) {
    const source = text(item.GuarGroupID || item.TXCer?.FromGuarGroupID)
    const target = text(item.TXCer?.ToGuarGroupID)
    if (source) ids.add(source)
    if (target) ids.add(target)
  }
  return [...ids].sort()
}

interface GroupAuthority {
  groupID: string
  assignNode: string
  aggregationNode: string
  assignPublicKey?: PublicKeyV2
  aggregationPublicKey?: PublicKeyV2
}

function groupAuthority(value: unknown, fallbackID: string): GroupAuthority {
  const root = record(value)
  const groupMessage = record(first(root, 'GroupMsg', 'groupMsg'))
  const source =
    Object.keys(groupMessage).length > 0
      ? groupMessage
      : Object.keys(root).length === 1
        ? record(Object.values(root)[0])
        : root
  return {
    groupID: text(first(source, 'GroupID', 'groupID')) || fallbackID,
    assignNode: text(first(source, 'AssiID', 'assignNode', 'AssignID')),
    aggregationNode: text(first(source, 'AggrID', 'aggreNode', 'AggregationID')),
    assignPublicKey: publicKey(first(source, 'AssignPublicKeyNew', 'assignPublicKey')),
    aggregationPublicKey: publicKey(first(source, 'AggrPublicKeyNew', 'aggrPublicKey')),
  }
}

function certifierAuthorities(value: unknown): Array<{ id: string; key: PublicKeyV2 }> {
  return list(value, 'certifiers', 'Certifiers', 'items', 'data')
    .map((item) => {
      const source = record(item)
      return {
        id: text(first(source, 'CertifierID', 'certifierID', 'ID', 'id')),
        key: publicKey(first(source, 'PublicKeyNew', 'PublicKey', 'publicKey')),
      }
    })
    .filter((item): item is { id: string; key: PublicKeyV2 } => Boolean(item.id && item.key))
}

function liabilitySignerSetID(item: TXCerIssuanceRecordV2, groupID: string): string {
  const candidate = text(item.LiabilityReceipt?.SignerSetID)
  const prefix = `${groupID}:liability:v`
  const version = candidate.startsWith(prefix) ? candidate.slice(prefix.length) : ''
  return /^[1-9]\d*$/.test(version) ? candidate : `${groupID}:liability:v1`
}

export function buildCredentialAuthorities(
  records: TXCerIssuanceRecordV2[],
  groupResponses: Record<string, unknown>,
  certifierResponses: Record<string, unknown>,
  capturedAt = Date.now(),
): Record<string, TXCerAuthoritySnapshot> {
  const result: Record<string, TXCerAuthoritySnapshot> = {}
  for (const item of records) {
    const txCerID = text(item.TXCerID)
    const sourceID = text(item.GuarGroupID || item.TXCer?.FromGuarGroupID)
    const targetID = text(item.TXCer?.ToGuarGroupID) || sourceID
    const source = groupAuthority(groupResponses[sourceID], sourceID)
    const target = groupAuthority(groupResponses[targetID], targetID)
    if (
      !txCerID ||
      !source.aggregationPublicKey ||
      !source.assignPublicKey ||
      !target.assignPublicKey
    )
      continue

    const publicKeys: Record<string, PublicKeyV2> = {
      aggregation: source.aggregationPublicKey,
      aggr: source.aggregationPublicKey,
    }
    if (source.aggregationNode) publicKeys[source.aggregationNode] = source.aggregationPublicKey
    if (source.assignNode) publicKeys[source.assignNode] = source.assignPublicKey
    if (target.assignNode) publicKeys[target.assignNode] = target.assignPublicKey
    for (const certifier of certifierAuthorities(certifierResponses[sourceID])) {
      publicKeys[certifier.id] = certifier.key
      publicKeys[`certifier:${certifier.id}`] = certifier.key
    }
    const members = [
      ...new Set((item.LiabilityReceipt?.Signers ?? []).map(text).filter(Boolean)),
    ].sort()
    if (members.length === 0) continue
    result[txCerID] = {
      groupID: sourceID,
      signerSetID: liabilitySignerSetID(item, sourceID),
      members,
      threshold: Math.floor((2 * members.length) / 3) + 1,
      publicKeys,
      sourceAggregationPublicKey: source.aggregationPublicKey,
      sourceAssignPublicKey: source.assignPublicKey,
      targetAssignPublicKey: target.assignPublicKey,
      capturedAt,
    }
  }
  return result
}

function statusMap(response: unknown): Map<string, string> {
  const statuses = new Map<string, string>()
  for (const item of list(response, 'statuses', 'Statuses', 'records', 'items', 'data')) {
    const source = record(item)
    const id = text(first(source, 'TXCerID', 'txCerID', 'txcer_id', 'id'))
    if (id) statuses.set(id, text(first(source, 'Status', 'status', 'Lifecycle', 'lifecycle')))
  }
  return statuses
}

export function normalizeCredentialSummaries(
  records: TXCerIssuanceRecordV2[],
  lifecycleResponse: unknown,
  authorities: Record<string, TXCerAuthoritySnapshot>,
  checkedAt = Date.now(),
): WalletCredentialSummary[] {
  const lifecycles = statusMap(lifecycleResponse)
  return records
    .map((item) => {
      const txCerID = text(item.TXCerID)
      const lifecycle =
        lifecycles.get(txCerID) || text(first(item, 'Status', 'status')) || 'Unknown'
      const security = evaluateTXCerSecurity(
        {
          issuanceRecord: item,
          fastEvidence: item.FastEvidence,
          assignAck: item.Ack,
          liabilityReceipt: item.LiabilityReceipt,
          issuanceProof: item.Proof,
          authoritySnapshot: authorities[txCerID],
        },
        lifecycle,
        checkedAt,
      )
      const exposureShares: WalletExposureShareSummary[] = (item.TXCer?.ExposureShares ?? []).map(
        (share) => ({
          rootId: text(share.RootID),
          leafId: text(share.LeafID),
          groupId: text(share.GroupID),
          pledgeAddress: text(share.PledgeAddress),
          amount: canonicalAmount(share.Amount),
        }),
      )
      return {
        txCerId: txCerID,
        recordId: text(item.RecordID),
        lifecycle,
        amount: canonicalAmount(
          (item.TXCer?.Value ?? first(item, 'Value', 'value')) as
            string | number | bigint | null | undefined,
        ),
        toAddress: text(item.ToAddress || item.TXCer?.ToAddress),
        fastEvidenceStatus: security.fastEvidenceStatus,
        cfaaAuditStatus: security.cfaaAuditStatus,
        error: [security.fastEvidenceError, security.cfaaAuditError].filter(Boolean).join(' · '),
        hasFastEvidence: Boolean(item.FastEvidence),
        hasAssignAck: Boolean(item.Ack),
        hasLiabilityReceipt: Boolean(item.LiabilityReceipt),
        hasCFAAProof: Boolean(item.Proof),
        rootIds: [...new Set(item.RootExposureIDs ?? exposureShares.map((share) => share.rootId))]
          .filter(Boolean)
          .sort(),
        exposureShares,
      } satisfies WalletCredentialSummary
    })
    .sort((left, right) => left.recordId.localeCompare(right.recordId))
}
