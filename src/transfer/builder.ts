import { ec as EC } from 'elliptic'

import { canonicalAmount, formatRatio, parseAmount, RATIO_SCALE } from '@/protocol-v2/amount'
import {
  bytesToHex,
  canonicalJSONStringify,
  decodeBackendBytes,
  publicKey,
  sha256Bytes,
} from '@/protocol-v2/canonical'
import {
  canonicalizeTXCerSourceSignatureMaterialV2,
  computeSettlementAuthHashV2,
  computeSettlementIntentHashV2,
  computeTXCerIDV2,
  computeTXOutputHashCompatV2,
  computeTransactionIDV2,
  computeTransactionHashV2,
  normalizeTXCerForGoStructJSON,
  TRANSACTION_PROTOCOL_VERSION,
  zeroSettlementAuth,
} from '@/protocol-v2/transaction'
import type {
  PublicKeyV2,
  SettlementAuthV2,
  SignatureEnvelopeV2,
  TransactionV2,
  TXCerV2,
} from '@/protocol-v2/types'
import {
  assertTransferDraft,
  buildRetailAggregate,
  signUserNewTX,
  transferTypeForDraft,
  type InputSelection,
  type RetailAggregate,
  type TransferDraft,
  type UserNewTXV2,
} from '@/transfer/core'
import type { RecipientSpendMetadata } from '@/transfer/recipient'
import { buildSeedSpendArtifacts } from '@/transfer/seedChain'
import { deriveAddressFromRootSeed } from '@/wallet/identity'
import { validateWalletRecord } from '@/wallet/keystore'
import type { WalletAddressRecord, WalletRecord } from '@/wallet/types'

const ec = new EC('p256')
const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')
const SIGNATURE_ALGORITHM = 'ecdsa_p256'
const TX_ID_PATTERN = /^[0-9a-f]{64}$/i

type UnknownRecord = Record<string, unknown>

export interface BuildTransferTransactionInput {
  wallet: WalletRecord
  draft: TransferDraft
  selection: InputSelection
  recipient: RecipientSpendMetadata
  /** Authoritative current metadata for a pure-TXCer change output. */
  change?: RecipientSpendMetadata
  guarantorGroupID?: string
  /** Unix seconds; injectable so TXCer settlement signatures are reproducible in tests. */
  authTime?: number
}

export type TransferSubmission =
  { kind: 'retail'; body: RetailAggregate } | { kind: 'assign'; body: UserNewTXV2; groupID: string }

export interface BuiltTransferTransaction {
  tx: TransactionV2
  txID: string
  inputIDs: string[]
  submission: TransferSubmission
}

interface WalletAddressKey {
  record: WalletAddressRecord
  privateKeyHex: string
  publicKey: { CurveName: 'P256'; X: bigint; Y: bigint }
}

interface BuiltNormalInput {
  input: UnknownRecord
  addressKey: WalletAddressKey
  nextSeedAnchor: number[]
  nextSeedStep: number
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`)
  return value as UnknownRecord
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function string(value: unknown, label: string, allowEmpty = true): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()))
    throw new Error(`${label} must be a ${allowEmpty ? 'string' : 'non-empty string'}`)
  return value
}

function integer(value: unknown, label: string): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 0) throw new Error(`${label} is invalid`)
  return Number(parsed)
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean`)
  return value
}

function exactAmount(value: unknown, label: string): string {
  if (!['string', 'number', 'bigint'].includes(typeof value))
    throw new Error(`${label} amount is missing`)
  return canonicalAmount(value as string | number | bigint)
}

function normalizedPublicKey(value: unknown, label: string, allowZero = false) {
  const normalized = publicKey(record(value, label) as PublicKeyV2)
  if (normalized.CurveName !== 'P256' || normalized.X == null || normalized.Y == null)
    throw new Error(`${label} is incomplete`)
  if (allowZero && normalized.X === 0n && normalized.Y === 0n) return normalized
  if (normalized.X <= 0n || normalized.Y <= 0n) throw new Error(`${label} is invalid`)
  const key = ec.keyFromPublic(
    { x: normalized.X.toString(16), y: normalized.Y.toString(16) },
    'hex',
  )
  if (!key.validate().result) throw new Error(`${label} is not on P-256`)
  return normalized
}

function publicKeyFromHex(value: string): { CurveName: 'P256'; X: bigint; Y: bigint } {
  if (!/^04[0-9a-f]{128}$/i.test(value)) throw new Error('invalid derived address public key')
  return {
    CurveName: 'P256',
    X: BigInt(`0x${value.slice(2, 66)}`),
    Y: BigInt(`0x${value.slice(66)}`),
  }
}

function privateScalarFromBase64(value: string): string {
  const bytes = decodeBackendBytes(value)
  if (bytes.length !== 32) throw new Error('account private scalar must be 32 bytes')
  const scalar = BigInt(`0x${bytesToHex(bytes)}`)
  if (scalar <= 0n || scalar >= P256_ORDER) throw new Error('account private scalar is invalid')
  return bytesToHex(bytes)
}

function walletAddressKeys(wallet: WalletRecord): Map<string, WalletAddressKey> {
  const result = new Map<string, WalletAddressKey>()
  for (const address of wallet.addresses) {
    const type = integer(address.type, `wallet address ${address.address} type`)
    const rootSeed = decodeBackendBytes(address.root_seed)
    if (rootSeed.length !== 32)
      throw new Error(`wallet address ${address.address} RootSeed is invalid`)
    const derived = deriveAddressFromRootSeed(bytesToHex(rootSeed), type)
    if (derived.address !== address.address.toLowerCase())
      throw new Error(`wallet address ${address.address} does not match RootSeed`)
    if (result.has(derived.address)) throw new Error(`duplicate wallet address ${derived.address}`)
    result.set(derived.address, {
      record: address,
      privateKeyHex: derived.privateScalarHex,
      publicKey: publicKeyFromHex(derived.publicKeyHex),
    })
  }
  return result
}

function addressKey(keys: Map<string, WalletAddressKey>, address: string): WalletAddressKey {
  const key = keys.get(address.toLowerCase())
  if (!key) throw new Error(`input address ${address} is not in the wallet`)
  return key
}

function signHash(hash: ArrayLike<number>, privateKeyHex: string): SignatureEnvelopeV2 {
  const signature = ec.keyFromPrivate(privateKeyHex, 'hex').sign(Array.from(hash))
  return { Algorithm: SIGNATURE_ALGORITHM, Signature: signature.toDER() }
}

function signLegacyHash(hash: ArrayLike<number>, privateKeyHex: string) {
  const signature = ec.keyFromPrivate(privateKeyHex, 'hex').sign(Array.from(hash))
  return {
    R: BigInt(`0x${signature.r.toString(16)}`),
    S: BigInt(`0x${signature.s.toString(16)}`),
  }
}

function validateRecipient(draft: TransferDraft, recipient: RecipientSpendMetadata) {
  if (recipient.address !== draft.recipient.trim()) throw new Error('recipient address mismatch')
  if (recipient.coinType !== draft.coinType) throw new Error('recipient coin type mismatch')
  const seedAnchor = decodeBackendBytes(recipient.seedAnchor)
  if (draft.mode === 'cross') {
    const key = normalizedPublicKey(recipient.publicKey, 'cross-chain recipient public key', true)
    if (key.X !== 0n || key.Y !== 0n)
      throw new Error('cross-chain recipient public key must be zero')
    if (recipient.groupID !== '') throw new Error('cross-chain recipient group must be empty')
    if (
      seedAnchor.length !== 0 ||
      recipient.seedChainStep !== 0 ||
      recipient.defaultSpendAlgorithm !== ''
    )
      throw new Error('cross-chain recipient seed metadata must be zero')
    return { publicKey: key, seedAnchor }
  }

  string(recipient.groupID, 'recipient guarantor group')
  const key = normalizedPublicKey(recipient.publicKey, 'recipient public key')
  if (seedAnchor.length !== 32) throw new Error('recipient seed anchor must be 32 bytes')
  if (!Number.isSafeInteger(recipient.seedChainStep) || recipient.seedChainStep <= 0)
    throw new Error('recipient seed chain step must be a positive integer')
  if (recipient.defaultSpendAlgorithm !== SIGNATURE_ALGORITHM)
    throw new Error('recipient spend algorithm is unsupported')
  return { publicKey: key, seedAnchor }
}

function validateSelection(draft: TransferDraft, selection: InputSelection): void {
  const hasTXCer = selection.txCers.length > 0
  if (draft.usesTXCer !== hasTXCer) throw new Error('draft TXCer usage does not match selection')
  if (draft.mode === 'normal' && hasTXCer) throw new Error('normal transfer cannot use TXCer')
  if (draft.mode === 'cross' && hasTXCer) throw new Error('cross-chain transfer cannot use TXCer')

  const ids = new Set<string>()
  let total = 0n
  for (const input of [...selection.utxos, ...selection.txCers]) {
    if (!input.id || ids.has(input.id)) throw new Error(`duplicate selected input ${input.id}`)
    ids.add(input.id)
    if (input.coinType !== draft.coinType) throw new Error(`input ${input.id} coin type mismatch`)
    const amount = parseAmount(input.amount)
    if (amount <= 0n) throw new Error(`input ${input.id} amount must be positive`)
    total += amount
  }
  if (selection.utxoIDs.length !== selection.utxos.length)
    throw new Error('selected UTXO IDs are incomplete')
  if (selection.txCerIDs.length !== selection.txCers.length)
    throw new Error('selected TXCer IDs are incomplete')
  selection.utxos.forEach((input, index) => {
    if (selection.utxoIDs[index] !== input.id) throw new Error('selected UTXO IDs do not match')
  })
  selection.txCers.forEach((input, index) => {
    if (selection.txCerIDs[index] !== input.id) throw new Error('selected TXCer IDs do not match')
  })

  const required = parseAmount(draft.amount)
  if (total < required) throw new Error('selected inputs are insufficient')
  if (parseAmount(selection.total) !== total) throw new Error('selected input total mismatch')
  if (parseAmount(selection.change) !== total - required)
    throw new Error('selected change mismatch')
}

function buildNormalInput(
  spendable: InputSelection['utxos'][number],
  keys: Map<string, WalletAddressKey>,
): BuiltNormalInput {
  const source = record(spendable.input, `UTXO ${spendable.id}`)
  const sourceTX = record(source.UTXO, `UTXO ${spendable.id} source transaction`)
  const sourceTXID = string(sourceTX.TXID, `UTXO ${spendable.id} source TXID`, false)
  if (!TX_ID_PATTERN.test(sourceTXID))
    throw new Error(`UTXO ${spendable.id} source TXID is invalid`)
  const position = record(source.Position, `UTXO ${spendable.id} position`)
  const normalizedPosition = {
    Blocknum: integer(position.Blocknum, `UTXO ${spendable.id} block number`),
    IndexX: integer(position.IndexX, `UTXO ${spendable.id} aggregate index`),
    IndexY: integer(position.IndexY, `UTXO ${spendable.id} transaction index`),
    IndexZ: integer(position.IndexZ, `UTXO ${spendable.id} output index`),
  }
  const outputs = array(sourceTX.TXOutputs, `UTXO ${spendable.id} TXOutputs`)
  const referenced = record(
    outputs[normalizedPosition.IndexZ],
    `UTXO ${spendable.id} referenced output`,
  )
  const referencedAddress = string(
    referenced.ToAddress,
    `UTXO ${spendable.id} output address`,
    false,
  )
  if (referencedAddress.toLowerCase() !== spendable.address.toLowerCase())
    throw new Error(`UTXO ${spendable.id} output address mismatch`)
  const value = exactAmount(referenced.ToValue, `UTXO ${spendable.id} output`)
  if (value !== canonicalAmount(spendable.amount))
    throw new Error(`UTXO ${spendable.id} value mismatch`)
  if (exactAmount(source.Value, `UTXO ${spendable.id}`) !== value)
    throw new Error(`UTXO ${spendable.id} stored value mismatch`)
  const coinType = integer(referenced.Type, `UTXO ${spendable.id} output type`)
  if (
    coinType !== spendable.coinType ||
    integer(source.Type, `UTXO ${spendable.id} type`) !== coinType
  )
    throw new Error(`UTXO ${spendable.id} type mismatch`)
  const seedAnchor = decodeBackendBytes(referenced.SeedAnchor as never)
  if (seedAnchor.length !== 32) throw new Error(`UTXO ${spendable.id} seed anchor is invalid`)
  const seedStep = integer(referenced.SeedChainStep, `UTXO ${spendable.id} seed chain step`)
  if (seedStep <= 0) throw new Error(`UTXO ${spendable.id} seed chain is exhausted`)
  if (
    string(referenced.DefaultSpendAlgorithm, `UTXO ${spendable.id} spend algorithm`) !==
    SIGNATURE_ALGORITHM
  )
    throw new Error(`UTXO ${spendable.id} spend algorithm is unsupported`)

  const outputForHash = {
    ToAddress: referencedAddress,
    ToValue: value,
    ToGuarGroupID: string(referenced.ToGuarGroupID, `UTXO ${spendable.id} output group`),
    ToPublicKey: normalizedPublicKey(
      referenced.ToPublicKey,
      `UTXO ${spendable.id} output public key`,
    ),
    ToInterest: exactAmount(referenced.ToInterest, `UTXO ${spendable.id} output interest`),
    Type: coinType,
    ToPeerID: string(referenced.ToPeerID, `UTXO ${spendable.id} output peer`),
    IsPayForGas: boolean(referenced.IsPayForGas, `UTXO ${spendable.id} gas flag`),
    IsCrossChain: boolean(referenced.IsCrossChain, `UTXO ${spendable.id} cross-chain flag`),
    IsGuarMake: boolean(referenced.IsGuarMake, `UTXO ${spendable.id} guarantor flag`),
    SeedAnchor: seedAnchor,
    SeedChainStep: seedStep,
    DefaultSpendAlgorithm: SIGNATURE_ALGORITHM,
  }
  const hash = computeTXOutputHashCompatV2(outputForHash)
  const key = addressKey(keys, spendable.address)
  const seed = buildSeedSpendArtifacts(hash, key.privateKeyHex, seedAnchor, seedStep)
  return {
    addressKey: key,
    nextSeedAnchor: seed.SeedReveal,
    nextSeedStep: seedStep - 1,
    input: {
      FromTXID: sourceTXID,
      FromTxPosition: normalizedPosition,
      FromAddress: spendable.address,
      IsGuarMake: false,
      IsCommitteeMake: false,
      IsCrossChain: false,
      InputSignature: signLegacyHash(hash, key.privateKeyHex),
      TXOutputHash: hash,
      InputSignatureV2: seed.InputSignatureV2,
      SeedReveal: seed.SeedReveal,
      SeedPublicKeyV2: seed.SeedPublicKeyV2,
      SeedChainStep: seed.SeedChainStep,
    },
  }
}

function validateAndSignTXCer(
  spendable: InputSelection['txCers'][number],
  accountPrivateKeyHex: string,
  keys: Map<string, WalletAddressKey>,
): TXCerV2 {
  if (!TX_ID_PATTERN.test(spendable.id)) throw new Error(`TXCer ${spendable.id} ID is invalid`)
  if (spendable.lifecycle !== 'Active' || spendable.isolated)
    throw new Error(`TXCer ${spendable.id} is not spendable`)
  addressKey(keys, spendable.address)
  const txCer = spendable.txCer
  if (txCer.TXCerID !== spendable.id) throw new Error(`TXCer ${spendable.id} identity mismatch`)
  if (String(txCer.ToAddress ?? '').toLowerCase() !== spendable.address.toLowerCase())
    throw new Error(`TXCer ${spendable.id} address mismatch`)
  if (exactAmount(txCer.Value, `TXCer ${spendable.id}`) !== canonicalAmount(spendable.amount))
    throw new Error(`TXCer ${spendable.id} value mismatch`)
  if (!TX_ID_PATTERN.test(String(txCer.TXID ?? '')))
    throw new Error(`TXCer ${spendable.id} source TXID is invalid`)
  string(txCer.FromGuarGroupID, `TXCer ${spendable.id} source group`, false)
  string(txCer.ToGuarGroupID, `TXCer ${spendable.id} destination group`, false)
  integer(txCer.ConstructionTime, `TXCer ${spendable.id} construction time`)
  integer(txCer.Size, `TXCer ${spendable.id} size`)
  if (!Array.isArray(txCer.ExposureShares))
    throw new Error(`TXCer ${spendable.id} exposure shares are missing`)
  const position = record(txCer.TxCerPosition, `TXCer ${spendable.id} position`)
  integer(position.BlockHeight, `TXCer ${spendable.id} block height`)
  integer(position.Index, `TXCer ${spendable.id} index`)
  integer(position.InIndex, `TXCer ${spendable.id} input index`)
  if (computeTXCerIDV2(txCer) !== spendable.id)
    throw new Error(`TXCer ${spendable.id} hash mismatch`)

  const normalized = normalizeTXCerForGoStructJSON(txCer) as TXCerV2
  const sourceHash = sha256Bytes(
    canonicalJSONStringify(canonicalizeTXCerSourceSignatureMaterialV2(txCer)),
  )
  normalized.UserSignatureV2 = signHash(sourceHash, accountPrivateKeyHex)
  normalized.SettlementAuth = zeroSettlementAuth()
  return normalized
}

function buildBackAssign(draft: TransferDraft, selection: InputSelection): Record<string, string> {
  const addresses = [
    ...new Set([...selection.utxos, ...selection.txCers].map((input) => input.address)),
  ]
  if (addresses.length === 0) throw new Error('at least one selected input is required')
  if (draft.membership === 'member') return { [addresses[0]!]: '1' }
  const count = BigInt(addresses.length)
  const base = RATIO_SCALE / count
  let remainder = RATIO_SCALE % count
  const result: Record<string, string> = {}
  for (const address of addresses) {
    result[address] = formatRatio(base + (remainder > 0n ? 1n : 0n))
    if (remainder > 0n) remainder -= 1n
  }
  return result
}

function attachSettlementAuths(
  tx: TransactionV2,
  accountPrivateKeyHex: string,
  authTime: number,
): void {
  for (const txCer of tx.TXInputsCertificate ?? []) {
    const auth: SettlementAuthV2 = {
      Version: 1,
      TXCerID: String(txCer.TXCerID),
      SourceTXID: String(txCer.TXID),
      SourcePosition: txCer.TxCerPosition,
      Value: txCer.Value,
      FromGuarGroupID: txCer.FromGuarGroupID,
      ToGuarGroupID: txCer.ToGuarGroupID,
      PledgeAddress: String(txCer.SourcePledgeAddress ?? ''),
      ConsumeIntentHash: computeSettlementIntentHashV2(tx, String(txCer.TXCerID)),
      AuthTime: authTime,
      UserSignatureV2: { Algorithm: '', Signature: null },
    }
    auth.UserSignatureV2 = signHash(computeSettlementAuthHashV2(auth), accountPrivateKeyHex)
    txCer.SettlementAuth = auth
  }
}

export function buildTransferTransaction(
  input: BuildTransferTransactionInput,
): BuiltTransferTransaction {
  const wallet = validateWalletRecord(input.wallet)
  assertTransferDraft(input.draft)
  validateSelection(input.draft, input.selection)
  const accountPrivateKeyHex = privateScalarFromBase64(wallet.account_private_scalar)
  const keys = walletAddressKeys(wallet)
  const recipient = validateRecipient(input.draft, input.recipient)
  const guarantorGroupID = String(input.guarantorGroupID ?? '').trim()
  if (input.draft.membership === 'member' && !guarantorGroupID)
    throw new Error('guarantor group is required')
  if (input.draft.membership === 'retail' && guarantorGroupID)
    throw new Error('retail transfer cannot declare a guarantor group')

  const txType = transferTypeForDraft(input.draft)
  const normalInputs = input.selection.utxos.map((utxo) => buildNormalInput(utxo, keys))
  const certificateInputs = input.selection.txCers.map((txCer) =>
    validateAndSignTXCer(txCer, accountPrivateKeyHex, keys),
  )
  const outputs: UnknownRecord[] = [
    {
      ToAddress: input.recipient.address,
      ToValue: canonicalAmount(input.draft.amount),
      ToGuarGroupID: input.recipient.groupID,
      ToPublicKey: recipient.publicKey,
      ToInterest: '0',
      Type: input.draft.coinType,
      ToPeerID: '',
      IsPayForGas: false,
      IsCrossChain: input.draft.mode === 'cross',
      IsGuarMake: false,
      SeedAnchor: recipient.seedAnchor,
      SeedChainStep: input.recipient.seedChainStep,
      DefaultSpendAlgorithm: input.recipient.defaultSpendAlgorithm,
    },
  ]

  const change = parseAmount(input.selection.change)
  if (change > 0n) {
    const changeInput = normalInputs.find((item) => item.nextSeedStep > 0)
    const changeMetadata = input.change
    const changeAddress = changeInput?.addressKey.record.address ?? changeMetadata?.address ?? ''
    if (
      !changeAddress ||
      ![...input.selection.utxos, ...input.selection.txCers].some(
        (item) => item.address === changeAddress,
      )
    )
      throw new Error('change address is not an authoritative selected-input address')
    const changePublicKey =
      changeInput?.addressKey.publicKey ??
      normalizedPublicKey(changeMetadata?.publicKey, 'change public key')
    const changeSeedAnchor =
      changeInput?.nextSeedAnchor ?? decodeBackendBytes(changeMetadata?.seedAnchor ?? [])
    const changeSeedStep = changeInput?.nextSeedStep ?? changeMetadata?.seedChainStep ?? 0
    const changeAlgorithm = changeInput
      ? SIGNATURE_ALGORITHM
      : String(changeMetadata?.defaultSpendAlgorithm ?? '')
    if (
      changeSeedAnchor.length !== 32 ||
      !Number.isSafeInteger(changeSeedStep) ||
      changeSeedStep <= 0
    )
      throw new Error('change seed metadata is invalid')
    if (changeAlgorithm !== SIGNATURE_ALGORITHM)
      throw new Error('change spend algorithm is unsupported')
    const expectedChangeGroup = input.draft.membership === 'member' ? guarantorGroupID : ''
    if (!changeInput && String(changeMetadata?.groupID ?? '') !== expectedChangeGroup)
      throw new Error('change guarantor group mismatch')
    outputs.push({
      ToAddress: changeAddress,
      ToValue: canonicalAmount(input.selection.change),
      ToGuarGroupID: expectedChangeGroup,
      ToPublicKey: changePublicKey,
      ToInterest: '0',
      Type: input.draft.coinType,
      ToPeerID: '',
      IsPayForGas: false,
      IsCrossChain: false,
      IsGuarMake: false,
      SeedAnchor: changeSeedAnchor,
      SeedChainStep: changeSeedStep,
      DefaultSpendAlgorithm: changeAlgorithm,
    })
  }

  const tx: TransactionV2 = {
    TXID: '',
    Size: 0,
    Version: TRANSACTION_PROTOCOL_VERSION,
    GuarantorGroup: input.draft.membership === 'member' ? guarantorGroupID : '',
    TXType: txType,
    Value: canonicalAmount(input.draft.amount),
    ValueDivision: { [input.draft.coinType]: canonicalAmount(input.draft.amount) },
    NewValue: '0',
    NewValueDiv: {},
    InterestAssign: {
      Gas: '0',
      Output: '0',
      BackAssign: buildBackAssign(input.draft, input.selection),
    },
    UserSignature: { R: null, S: null },
    UserSignatureV2: { Algorithm: '', Signature: null },
    TXInputsNormal: normalInputs.map((item) => item.input),
    TXInputsCertificate: certificateInputs,
    TXOutputs: outputs,
    Data: [],
  }

  if (certificateInputs.length > 0) {
    const authTime = input.authTime ?? Math.floor(Date.now() / 1000)
    if (!Number.isSafeInteger(authTime) || authTime <= 0)
      throw new Error('settlement auth time is invalid')
    attachSettlementAuths(tx, accountPrivateKeyHex, authTime)
  }
  tx.UserSignatureV2 = signHash(computeTransactionHashV2(tx), accountPrivateKeyHex)
  tx.TXID = computeTransactionIDV2(tx)
  if (!TX_ID_PATTERN.test(tx.TXID)) throw new Error('constructed transaction ID is invalid')

  const inputIDs = [...input.selection.utxoIDs, ...input.selection.txCerIDs]
  if (input.draft.membership === 'retail') {
    return {
      tx,
      txID: tx.TXID,
      inputIDs,
      submission: { kind: 'retail', body: buildRetailAggregate(tx) },
    }
  }

  const userNewTX = signUserNewTX({ TX: tx, UserID: wallet.account_id }, accountPrivateKeyHex)
  return {
    tx,
    txID: tx.TXID,
    inputIDs,
    submission: { kind: 'assign', body: userNewTX, groupID: guarantorGroupID },
  }
}
