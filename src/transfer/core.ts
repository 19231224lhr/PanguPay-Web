import { ec as EC } from 'elliptic'

import {
  bytesToBase64,
  bytesToHex,
  canonicalJSONStringify,
  decodeBackendBytes,
  hexToBytes,
  sha256Bytes,
} from '@/protocol-v2/canonical'
import { normalizeTransactionForGoStructJSON } from '@/protocol-v2/transaction'
import { formatAmount, isWholeAmount, parseAmount } from '@/protocol-v2/amount'
import type {
  PublicKeyEnvelopeV2,
  SignatureEnvelopeV2,
  TransactionV2,
  TXCerV2,
} from '@/protocol-v2/types'

const ec = new EC('p256')

export type TransferMode = 'normal' | 'quick' | 'cross'
export type TransferMembership = 'retail' | 'member'

export interface SpendableUTXO {
  id: string
  address: string
  coinType: number
  amount: string
  /** Backend TXInputNormal material. The UI must not reconstruct it from a balance. */
  input: Record<string, unknown>
}

export interface SpendableTXCer {
  id: string
  address: string
  coinType: number
  amount: string
  lifecycle: string
  isolated?: boolean
  /** Complete certificate, including SettlementAuth source material. */
  txCer: TXCerV2
}

export interface WalletSpendableSnapshot {
  utxos: SpendableUTXO[]
  txCers: SpendableTXCer[]
}

export interface InputSelectionRequest {
  coinType: number
  amount: string
  address?: string
  preferTXCer?: boolean
  reservedIDs?: ReadonlySet<string>
}

export interface InputSelection {
  utxos: SpendableUTXO[]
  txCers: SpendableTXCer[]
  utxoIDs: string[]
  txCerIDs: string[]
  total: string
  change: string
}

export interface TransferDraft {
  mode: TransferMode
  membership: TransferMembership
  coinType: number
  amount: string
  recipient: string
  usesTXCer: boolean
}

export interface CanonicalSignature {
  signature: SignatureEnvelopeV2
  publicKey: PublicKeyEnvelopeV2
}

export interface UserNewTXV2 {
  TX: TransactionV2
  UserID: string
  Height: number
  Sig: { R: bigint | null; S: bigint | null }
}

export interface RetailAggregateMaterial {
  AggrTXType: 2
  IsGuarCommittee: false
  IsNoGuarGroupTX: true
  GuarantorGroupID: ''
  TXNum: 1
  TotalGas: string
  Version: 1
  AllTransactions: Array<Record<string, unknown>>
}

export interface RetailAggregate extends RetailAggregateMaterial {
  GuarantorGroupSig: { R: bigint | null; S: bigint | null }
  TXHash: string
  TXSize: number
}

function activeCertificate(value: SpendableTXCer): boolean {
  return value.lifecycle === 'Active' && !value.isolated && parseAmount(value.amount) > 0n
}

function select<T extends { id: string; amount: string }>(
  candidates: T[],
  target: bigint,
  selected: T[],
): bigint {
  let total = 0n
  for (const candidate of candidates) {
    if (total >= target) break
    selected.push(candidate)
    total += parseAmount(candidate.amount)
  }
  return total
}

export function utxoSeedSweepKey(utxo: SpendableUTXO): string {
  const wrapper = utxo.input as Record<string, unknown>
  const position = wrapper.Position as Record<string, unknown> | undefined
  const source = wrapper.UTXO as Record<string, unknown> | undefined
  const outputs = source?.TXOutputs
  const outputIndex = Number(position?.IndexZ)
  const output =
    Array.isArray(outputs) && Number.isSafeInteger(outputIndex)
      ? (outputs[outputIndex] as Record<string, unknown> | undefined)
      : undefined
  const step = Number(output?.SeedChainStep)
  const anchor = decodeBackendBytes(output?.SeedAnchor as never)
  if (!Number.isSafeInteger(step) || step <= 0 || anchor.length === 0) return `utxo:${utxo.id}`
  return `${utxo.address.toLowerCase()}:${utxo.coinType}:${step}:${bytesToBase64(anchor)}`
}

function selectableUTXOGroups(
  candidates: SpendableUTXO[],
  reserved: ReadonlySet<string>,
): SpendableUTXO[][] {
  const groups = new Map<string, SpendableUTXO[]>()
  for (const candidate of candidates) {
    const key = utxoSeedSweepKey(candidate)
    const group = groups.get(key) ?? []
    group.push(candidate)
    groups.set(key, group)
  }
  return [...groups.values()]
    .filter((group) => !group.some((candidate) => reserved.has(candidate.id)))
    .sort((left, right) => left[0]!.id.localeCompare(right[0]!.id))
}

function selectUTXOGroups(
  groups: SpendableUTXO[][],
  target: bigint,
  selected: SpendableUTXO[],
): bigint {
  let total = 0n
  for (const group of groups) {
    if (total >= target) break
    selected.push(...group)
    for (const candidate of group) total += parseAmount(candidate.amount)
  }
  return total
}

/** Selects deterministic spendable inputs; caller owns reservation persistence. */
export function selectSpendableInputs(
  snapshot: WalletSpendableSnapshot,
  request: InputSelectionRequest,
): InputSelection {
  const target = parseAmount(request.amount)
  if (target <= 0n) throw new Error('amount must be positive')
  const reserved = request.reservedIDs ?? new Set<string>()
  const byID = <T extends { id: string }>(items: T[]) =>
    items
      .filter((item) => !reserved.has(item.id))
      .sort((left, right) => left.id.localeCompare(right.id))
  const utxoGroups = selectableUTXOGroups(
    snapshot.utxos
      .filter(
        (item) =>
          item.coinType === request.coinType &&
          (!request.address || item.address === request.address) &&
          parseAmount(item.amount) > 0n,
      )
      .sort((left, right) => left.id.localeCompare(right.id)),
    reserved,
  )
  const txCers = byID(snapshot.txCers).filter(
    (item) =>
      item.coinType === request.coinType &&
      (!request.address || item.address === request.address) &&
      activeCertificate(item),
  )
  const selectedUTXOs: SpendableUTXO[] = []
  const selectedTXCers: SpendableTXCer[] = []
  let total = 0n
  if (request.preferTXCer) total = select(txCers, target, selectedTXCers)
  if (total < target) total += selectUTXOGroups(utxoGroups, target - total, selectedUTXOs)
  if (total < target) throw new Error('insufficient spendable balance')
  return {
    utxos: selectedUTXOs,
    txCers: selectedTXCers,
    utxoIDs: selectedUTXOs.map((item) => item.id),
    txCerIDs: selectedTXCers.map((item) => item.id),
    total: formatAmount(total),
    change: formatAmount(total - target),
  }
}

/** Validates only protocol-invariant mode constraints; UI availability remains a presentation concern. */
export function assertTransferDraft(draft: TransferDraft): void {
  if (parseAmount(draft.amount) <= 0n) throw new Error('amount must be positive')
  if (!draft.recipient.trim()) throw new Error('recipient is required')
  if (draft.mode === 'quick' && draft.membership !== 'member')
    throw new Error('quick transfer requires a guarantor organization')
  if (draft.mode !== 'cross') return
  if (draft.membership !== 'member')
    throw new Error('cross-chain transfer requires a guarantor organization')
  if (draft.coinType !== 0) throw new Error('cross-chain transfer supports PGC only')
  if (!isWholeAmount(draft.amount)) throw new Error('cross-chain transfer requires whole PGC')
  if (draft.usesTXCer) throw new Error('cross-chain transfer cannot use TXCer')
  if (!/^0x[0-9a-f]{40}$/i.test(draft.recipient)) throw new Error('invalid light-compute address')
}

export function transferTypeForDraft(draft: TransferDraft): 0 | 1 | 6 | 8 {
  assertTransferDraft(draft)
  if (draft.mode === 'cross') return 6
  if (draft.mode === 'normal' && draft.membership === 'retail') return 8
  return draft.usesTXCer ? 1 : 0
}

/** Builds the Go AggregateGTX pre-hash material for a single retail TXType=8 transaction. */
export function buildRetailAggregateMaterial(tx: TransactionV2): RetailAggregateMaterial {
  if (tx.TXType !== 8) throw new Error('retail aggregate requires TXType=8')
  return {
    AggrTXType: 2,
    IsGuarCommittee: false,
    IsNoGuarGroupTX: true,
    GuarantorGroupID: '',
    TXNum: 1,
    TotalGas: String(tx.InterestAssign?.Gas ?? '0'),
    Version: 1,
    AllTransactions: [
      {
        TXID: String(tx.TXID ?? ''),
        TXType: 8,
        Version: Number(tx.Version ?? 0),
        GuarantorGroup: String(tx.GuarantorGroup ?? ''),
        Value: tx.Value ?? '0',
        ValueDivision: tx.ValueDivision ?? {},
        NewValue: tx.NewValue ?? '0',
        NewValueDiv: tx.NewValueDiv ?? {},
        TXInputsNormal: tx.TXInputsNormal ?? [],
        TXInputsCertificate: tx.TXInputsCertificate ?? [],
        TXOutputs: tx.TXOutputs ?? [],
        InterestAssign: tx.InterestAssign ?? { Gas: '0', Output: '0', BackAssign: {} },
        ExTXCerID: [],
        ExRootShareID: [],
        Data: tx.Data ?? [],
        UserSignatureV2: tx.UserSignatureV2 ?? { Algorithm: '', Signature: null },
      },
    ],
  }
}

/** Completes the Go AggregateGTX envelope. GetATXHash excludes Sig, TXHash and TXSize. */
export function buildRetailAggregate(tx: TransactionV2): RetailAggregate {
  const material = buildRetailAggregateMaterial(tx)
  return {
    ...material,
    GuarantorGroupSig: { R: null, S: null },
    TXHash: bytesToBase64(sha256Bytes(canonicalJSONStringify(material))),
    TXSize: 0,
  }
}

/** Adds a local reservation; duplicate input IDs fail closed. */
export function reserveInputs(
  existing: ReadonlySet<string>,
  inputIDs: readonly string[],
): Set<string> {
  const next = new Set(existing)
  for (const id of inputIDs) {
    if (!id || next.has(id)) throw new Error(`input already reserved: ${id}`)
    next.add(id)
  }
  return next
}

export function signCanonicalMaterial(
  material: unknown,
  privateKeyHex: string,
): CanonicalSignature {
  const hash = sha256Bytes(canonicalJSONStringify(material))
  const key = ec.keyFromPrivate(privateKeyHex.replace(/^0x/i, ''), 'hex')
  const signature = hexToBytes(key.sign(hash).toDER('hex'))
  return {
    signature: { Algorithm: 'ecdsa_p256', Signature: bytesToBase64(signature) },
    publicKey: {
      Algorithm: 'ecdsa_p256',
      PublicKey: bytesToBase64(hexToBytes(key.getPublic().encode('hex', false))),
    },
  }
}

export function verifyCanonicalMaterial(material: unknown, signed: CanonicalSignature): boolean {
  try {
    if (signed.signature.Algorithm !== 'ecdsa_p256' || signed.publicKey.Algorithm !== 'ecdsa_p256')
      return false
    const publicKey = decodeBackendBytes(signed.publicKey.PublicKey)
    const signature = decodeBackendBytes(signed.signature.Signature)
    return ec
      .keyFromPublic(bytesToHex(publicKey), 'hex')
      .verify(sha256Bytes(canonicalJSONStringify(material)), signature)
  } catch {
    return false
  }
}

/** Go UserNewTX outer-signature material. `TX` must already be protocol-v2 normalized. */
export function canonicalizeUserNewTXSignatureMaterial(value: Pick<UserNewTXV2, 'TX' | 'UserID'>) {
  // Go SignStruct zeroes excluded struct fields before json.Marshal; it does not
  // remove them. Preserve the Go field order and zero-value representation.
  return {
    TX: normalizeTransactionForGoStructJSON(value.TX),
    UserID: value.UserID,
    Height: 0,
    Sig: { R: null, S: null },
  }
}

export function signUserNewTX(
  value: Pick<UserNewTXV2, 'TX' | 'UserID'>,
  privateKeyHex: string,
): UserNewTXV2 {
  const material = canonicalizeUserNewTXSignatureMaterial(value)
  const key = ec.keyFromPrivate(privateKeyHex.replace(/^0x/i, ''), 'hex')
  const sig = key.sign(sha256Bytes(canonicalJSONStringify(material)))
  return {
    TX: value.TX,
    UserID: value.UserID,
    Height: 0,
    Sig: { R: BigInt(`0x${sig.r.toString(16)}`), S: BigInt(`0x${sig.s.toString(16)}`) },
  }
}
