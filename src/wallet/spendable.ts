import { canonicalAmount, parseAmount } from '@/protocol-v2/amount'
import type { TXCerAuthoritySnapshot } from '@/protocol-v2/security'
import type { TXCerIssuanceRecordV2, TXCerV2 } from '@/protocol-v2/types'
import type { GatewayClient } from '@/services/gatewayClient'
import { utxoSeedSweepKey } from '@/transfer/core'
import type { SpendableTXCer, SpendableUTXO, WalletSpendableSnapshot } from '@/transfer/core'
import {
  buildCredentialAuthorities,
  credentialGroupIDs,
  extractIssuanceRecords,
  mergeTXCerDeliveryEnvelopes,
  mergeTXCerIssuanceResponses,
  normalizeCredentialSummaries,
} from '@/wallet/credentials'
import { blockedTXCerSourceOutputs, utxoSourceOutputKey } from '@/wallet/txcerLifecycle'

type UnknownRecord = Record<string, unknown>

export interface WalletSpendableNormalizationInput {
  userID: string
  addresses: string[]
  addressResponse: unknown
  issuanceResponse?: unknown
  lifecycleResponse?: unknown
  authorities?: Record<string, TXCerAuthoritySnapshot>
}

export interface WalletSpendableLoadRequest {
  userID: string
  addresses: string[]
  reOnlineMessage: unknown
  receivedTXCers?: unknown[]
}

export interface LoadedWalletSpendableSnapshot extends WalletSpendableSnapshot {
  membership: 'retail' | 'member'
  guarantorGroupID: string
  receivedTXCers: unknown[]
}

function record(value: unknown, label: string): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(`${label} must be an object`)
  return value as UnknownRecord
}

function optionalRecord(value: unknown, label: string): UnknownRecord {
  if (value == null) return {}
  return record(value, label)
}

function amount(value: unknown, label: string): string {
  if (!['string', 'number', 'bigint'].includes(typeof value))
    throw new Error(`${label} amount is missing`)
  const normalized = canonicalAmount(value as string | number | bigint)
  if (parseAmount(normalized) <= 0n) throw new Error(`${label} amount must be positive`)
  return normalized
}

function integer(value: unknown, label: string): number {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value
  if (!Number.isSafeInteger(parsed) || Number(parsed) < 0) throw new Error(`${label} is invalid`)
  return Number(parsed)
}

function addressSet(addresses: string[]): Set<string> {
  const result = new Set<string>()
  for (const value of addresses) {
    const address = value.trim()
    if (!address || result.has(address))
      throw new Error('wallet addresses must be unique and non-empty')
    result.add(address)
  }
  return result
}

function normalizeUTXOs(
  addresses: Set<string>,
  response: unknown,
  lifecycleResponse?: unknown,
): SpendableUTXO[] {
  const root = record(response, 'query-address response')
  const addressData = record(root.AddressData, 'query-address AddressData')
  const blockedSources = blockedTXCerSourceOutputs(lifecycleResponse)
  const seen = new Set<string>()
  const candidates: Array<{ utxo: SpendableUTXO; blocked: boolean }> = []
  for (const address of [...addresses].sort()) {
    if (addressData[address] == null) continue
    const state = record(addressData[address], `address ${address}`)
    const utxos = optionalRecord(state.UTXO, `address ${address} UTXO`)
    for (const id of Object.keys(utxos).sort()) {
      if (!id || seen.has(id)) throw new Error(`duplicate UTXO ${id}`)
      const data = record(utxos[id], `UTXO ${id}`)
      const source = record(data.UTXO, `UTXO ${id} source transaction`)
      if (typeof source.TXID !== 'string' || !source.TXID.trim())
        throw new Error(`UTXO ${id} source transaction TXID is missing`)
      const position = record(data.Position, `UTXO ${id} position`)
      integer(position.Blocknum, `UTXO ${id} block number`)
      integer(position.IndexX, `UTXO ${id} aggregate index`)
      integer(position.IndexY, `UTXO ${id} transaction index`)
      const outputIndex = integer(position.IndexZ, `UTXO ${id} output index`)
      candidates.push({
        blocked: blockedSources.has(utxoSourceOutputKey(source.TXID, outputIndex)),
        utxo: {
          id,
          address,
          coinType: integer(data.Type, `UTXO ${id} coin type`),
          amount: amount(data.Value, `UTXO ${id}`),
          input: data,
        },
      })
      seen.add(id)
    }
  }
  const blockedSweepKeys = new Set(
    candidates
      .filter((candidate) => candidate.blocked)
      .map((candidate) => utxoSeedSweepKey(candidate.utxo)),
  )
  return candidates
    .filter(
      (candidate) => !candidate.blocked && !blockedSweepKeys.has(utxoSeedSweepKey(candidate.utxo)),
    )
    .map((candidate) => candidate.utxo)
}

function validatedTXCer(
  item: TXCerIssuanceRecordV2,
  userID: string,
  addresses: Set<string>,
): { id: string; address: string; amount: string; txCer: TXCerV2 } {
  const id = String(item.TXCerID ?? '')
  const txCer = item.TXCer
  if (!/^[0-9a-f]{64}$/i.test(id) || !txCer) throw new Error('issuance record has no full TXCer')
  if (String(txCer.TXCerID ?? '') !== id) throw new Error(`TXCer ${id} identity mismatch`)
  if (String(item.UserID ?? '') !== userID) throw new Error(`TXCer ${id} user mismatch`)
  const address = String(item.ToAddress || txCer.ToAddress || '')
  if (!addresses.has(address) || String(txCer.ToAddress ?? '') !== address)
    throw new Error(`TXCer ${id} destination mismatch`)
  return { id, address, amount: amount(txCer.Value, `TXCer ${id}`), txCer }
}

function normalizeTXCers(
  input: WalletSpendableNormalizationInput,
  addresses: Set<string>,
): SpendableTXCer[] {
  if (input.issuanceResponse == null) return []
  const records = extractIssuanceRecords(input.issuanceResponse)
  const summaries = new Map(
    normalizeCredentialSummaries(
      records,
      input.lifecycleResponse ?? { statuses: [] },
      input.authorities ?? {},
    ).map((item) => [item.txCerId, item]),
  )
  const seen = new Set<string>()
  return records
    .map((item) => {
      const certificate = validatedTXCer(item, input.userID, addresses)
      if (seen.has(certificate.id)) throw new Error(`duplicate TXCer ${certificate.id}`)
      const summary = summaries.get(certificate.id)
      if (!summary) throw new Error(`TXCer ${certificate.id} lifecycle is missing`)
      seen.add(certificate.id)
      return {
        ...certificate,
        coinType: 0,
        lifecycle: summary.lifecycle,
        isolated: summary.fastEvidenceStatus === 'Failed',
      }
    })
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function normalizeWalletSpendableSnapshot(
  input: WalletSpendableNormalizationInput,
): WalletSpendableSnapshot {
  if (!input.userID.trim()) throw new Error('userID is required')
  const addresses = addressSet(input.addresses)
  return {
    utxos: normalizeUTXOs(addresses, input.addressResponse, input.lifecycleResponse),
    txCers: normalizeTXCers(input, addresses),
  }
}

function reOnlineGroup(response: unknown, userID: string): string {
  const root = record(response, 're-online response')
  if (String(root.UserID ?? '') !== userID) throw new Error('re-online user mismatch')
  if (root.IsInGroup !== true) return ''
  const groupID = String(root.GuarantorGroupID ?? '').trim()
  if (!groupID) throw new Error('re-online group is missing')
  return groupID
}

export async function loadWalletSpendableSnapshot(
  client: GatewayClient,
  input: WalletSpendableLoadRequest,
): Promise<LoadedWalletSpendableSnapshot> {
  const addresses = [...addressSet(input.addresses)]
  const message = record(input.reOnlineMessage, 're-online request')
  if (String(message.UserID ?? '') !== input.userID)
    throw new Error('re-online request user mismatch')
  const [reOnlineResponse, addressResponse] = await Promise.all([
    client.reOnline(input.reOnlineMessage),
    client.queryAddresses(addresses),
  ])
  const groupID = reOnlineGroup(reOnlineResponse, input.userID)
  if (!groupID) {
    const snapshot = normalizeWalletSpendableSnapshot({
      userID: input.userID,
      addresses,
      addressResponse,
    })
    return { ...snapshot, membership: 'retail', guarantorGroupID: '', receivedTXCers: [] }
  }

  const [lifecycleResponse, issuanceResponse, deliveryResponse] = await Promise.all([
    client.txCerStatuses(groupID, input.userID),
    client.issuanceRecords(groupID, input.userID),
    client.pollCrossOrganizationTXCers(groupID, input.userID).catch(() => undefined),
  ])
  const receivedTXCers = mergeTXCerDeliveryEnvelopes(
    input.receivedTXCers ?? [],
    deliveryResponse,
    addresses,
  )
  const mergedIssuanceResponse = mergeTXCerIssuanceResponses(issuanceResponse, {
    txcers: receivedTXCers,
  })
  const records = extractIssuanceRecords(mergedIssuanceResponse)
  const groupIDs = credentialGroupIDs(records)
  const groupResponses: Record<string, unknown> = {}
  const certifierResponses: Record<string, unknown> = {}
  await Promise.all(
    groupIDs.map(async (id) => {
      ;[groupResponses[id], certifierResponses[id]] = await Promise.all([
        client.groupInfo(id),
        client.certifiers(id),
      ])
    }),
  )
  const authorities = buildCredentialAuthorities(records, groupResponses, certifierResponses)
  for (const authority of Object.values(authorities))
    authority.signerSetID = `${authority.groupID}:liability:v2`
  const snapshot = normalizeWalletSpendableSnapshot({
    userID: input.userID,
    addresses,
    addressResponse,
    issuanceResponse: mergedIssuanceResponse,
    lifecycleResponse,
    authorities,
  })
  return { ...snapshot, membership: 'member', guarantorGroupID: groupID, receivedTXCers }
}
