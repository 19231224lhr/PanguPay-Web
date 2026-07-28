import { ec as EC } from 'elliptic'

import {
  bytesToBase64,
  bytesToHex,
  canonicalJSONStringify,
  decodeBackendBytes,
  hexToBytes,
  sha256Bytes,
} from '@/protocol-v2/canonical'
import {
  buildRetailAddressOwnershipMaterial,
  buildRetailAddressRegistrationRequest,
} from '@/protocol-v2/addressRegistration'
import { signCanonicalMaterial } from '@/transfer'
import { deriveAddressFromRootSeed } from '@/wallet/identity'
import { configureWalletEntryService, type WalletEntryService } from '@/wallet/entryService'
import type { WalletRecord } from '@/wallet/types'
import { useWalletStore } from '@/stores/wallet'
import { pinia } from '@/stores/pinia'
import { GatewayClient } from './gatewayClient'

const ec = new EC('p256')
const SEED_CHAIN_LENGTH = 1_000
const SEED_DOMAIN = new TextEncoder().encode('pangu-seedchain-v2:0:')
const PANGU_EPOCH_SECONDS = Date.UTC(2020, 0, 1) / 1_000

export interface WalletEntryGatewayPort {
  groups(): Promise<unknown>
  reOnline(message: unknown): Promise<unknown>
  queryAddressGroups(addresses: string[]): Promise<unknown>
  queryAddresses(addresses: string[]): Promise<unknown>
  joinGroup(groupID: string, message: unknown): Promise<unknown>
  registerNoGroupAddress(message: unknown): Promise<unknown>
}

export interface GatewayWalletEntryOptions {
  gateway: WalletEntryGatewayPort
  getWalletRecord: () => WalletRecord | undefined
  timestamp?: () => number
  confirmationAttempts?: number
  sleep?: (milliseconds: number) => Promise<void>
}

interface PreparedAddress {
  address: string
  type: number
  privateKey: string
  publicKeyNew: ReturnType<typeof publicKeyNew>
  seedAnchor: string
  seedChainStep: number
  defaultSpendAlgorithm: 'ecdsa_p256'
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function unwrap(value: unknown): Record<string, unknown> {
  const current = object(value)
  if ('IsInGroup' in current || 'groups' in current || 'Addresstogroup' in current) return current
  for (const key of ['data', 'result']) {
    const nested = object(current[key])
    if (Object.keys(nested).length) return nested
  }
  return current
}

function publicKeyNew(privateKeyHex: string) {
  const point = ec.keyFromPrivate(privateKeyHex.replace(/^0x/i, ''), 'hex').getPublic()
  return {
    CurveName: 'P256',
    X: BigInt(`0x${point.getX().toString(16)}`),
    Y: BigInt(`0x${point.getY().toString(16)}`),
  }
}

function publicKeyEnvelope(privateKeyHex: string) {
  const key = ec.keyFromPrivate(privateKeyHex.replace(/^0x/i, ''), 'hex')
  return {
    Algorithm: 'ecdsa_p256',
    PublicKey: bytesToBase64(hexToBytes(key.getPublic().encode('hex', false))),
  }
}

function legacySignature(material: unknown, privateKeyHex: string): { R: bigint; S: bigint } {
  const signature = ec
    .keyFromPrivate(privateKeyHex.replace(/^0x/i, ''), 'hex')
    .sign(sha256Bytes(canonicalJSONStringify(material)))
  return {
    R: BigInt(`0x${signature.r.toString(16)}`),
    S: BigInt(`0x${signature.s.toString(16)}`),
  }
}

function initialSeedMetadata(privateKeyHex: string) {
  const scalar = hexToBytes(privateKeyHex.replace(/^0x/i, '').padStart(64, '0'))
  let current = sha256Bytes([...SEED_DOMAIN, ...scalar])
  current = sha256Bytes(current)
  for (let index = 1; index <= SEED_CHAIN_LENGTH; index += 1) current = sha256Bytes(current)
  return {
    seedAnchor: bytesToBase64(sha256Bytes(current)),
    seedChainStep: SEED_CHAIN_LENGTH,
    defaultSpendAlgorithm: 'ecdsa_p256' as const,
  }
}

function requireWallet(getWalletRecord: () => WalletRecord | undefined): WalletRecord {
  const record = getWalletRecord()
  if (!record) throw new Error('钱包尚未解锁。')
  if (!record.addresses.length) throw new Error('钱包没有可登记的地址。')
  return record
}

function walletSecretHex(value: string, label: string): string {
  const bytes = decodeBackendBytes(value)
  if (bytes.length !== 32) throw new Error(`${label} 必须为 32 字节。`)
  return bytesToHex(bytes)
}

function prepareAddresses(record: WalletRecord): PreparedAddress[] {
  return record.addresses
    .map((stored) => {
      const type = Number(stored.type)
      if (!Number.isInteger(type) || type < 0)
        throw new Error(`地址 ${stored.address} 的币种类型无效。`)
      const derived = deriveAddressFromRootSeed(
        walletSecretHex(stored.root_seed, `地址 ${stored.address} 的 RootSeed`),
        type,
      )
      if (derived.address !== stored.address.trim().toLowerCase())
        throw new Error(`地址 ${stored.address} 与 RootSeed 不匹配。`)
      return {
        address: derived.address,
        type,
        privateKey: derived.privateScalarHex,
        publicKeyNew: publicKeyNew(derived.privateScalarHex),
        ...initialSeedMetadata(derived.privateScalarHex),
      }
    })
    .sort((left, right) => left.address.localeCompare(right.address))
}

function reOnlineMessage(record: WalletRecord, addresses: PreparedAddress[]) {
  const accountPrivateKey = walletSecretHex(record.account_private_scalar, '账户私钥')
  const material = {
    UserID: record.account_id,
    FromPeerID: '',
    Address: addresses.map(({ address }) => address),
    Sig: { R: null, S: null },
  }
  return { ...material, Sig: legacySignature(material, accountPrivateKey) }
}

export function buildWalletReOnlineMessage(record: WalletRecord): unknown {
  return reOnlineMessage(record, prepareAddresses(record))
}

function addressGroupIDs(response: unknown, addresses: PreparedAddress[]): string[] {
  const payload = unwrap(response)
  const entries = object(
    payload.Addresstogroup ?? payload.AddressToGroup ?? payload.addresstogroup ?? payload.groups,
  )
  return addresses
    .map(({ address }) => {
      const info = object(entries[address] ?? entries[address.toLowerCase()])
      return String(info.GroupID ?? info.group_id ?? info.groupId ?? '').trim()
    })
    .filter(Boolean)
}

function reOnlineResult(response: unknown): { isInGroup: boolean; groupId?: string } {
  const payload = unwrap(response)
  const isInGroup = Boolean(payload.IsInGroup ?? payload.isInGroup)
  const groupId = String(
    payload.GuarantorGroupID ?? payload.guarantorGroupID ?? payload.groupId ?? '',
  ).trim()
  return groupId ? { isInGroup, groupId } : { isInGroup }
}

function assertAccepted(response: unknown, fallback: string): void {
  const payload = object(response)
  if (payload.success === false || payload.result === false) {
    throw new Error(String(payload.message ?? payload.error ?? fallback))
  }
}

function joinMessage(
  record: WalletRecord,
  addresses: PreparedAddress[],
  groupID: string,
  timestamp: number,
) {
  const accountPrivateKey = walletSecretHex(record.account_private_scalar, '账户私钥')
  const addressMsg: Record<string, unknown> = {}
  for (const address of addresses) {
    addressMsg[address.address] = {
      AddressData: {
        PublicKeyNew: address.publicKeyNew,
        Value: { TotalValue: '0', UTXOValue: '0', TXCerValue: '0' },
        Type: address.type,
        UTXO: null,
        TXCers: null,
        EstInterest: 0,
        LastHeight: 0,
        SeedAnchor: address.seedAnchor,
        SeedChainStep: address.seedChainStep,
        DefaultSpendAlgorithm: address.defaultSpendAlgorithm,
      },
      SeedAnchor: address.seedAnchor,
      SeedChainStep: address.seedChainStep,
      DefaultSpendAlgorithm: address.defaultSpendAlgorithm,
    }
  }
  const material = {
    Status: 1,
    UserID: record.account_id,
    UserPeerID: '',
    GuarGroupID: groupID,
    UserPublicKey: publicKeyNew(accountPrivateKey),
    SignPublicKeyV2: publicKeyEnvelope(accountPrivateKey),
    AddressMsg: addressMsg,
    TimeStamp: timestamp,
    UserSig: { R: null, S: null },
  }
  return { ...material, UserSig: legacySignature(material, accountPrivateKey) }
}

function currentTimestamp(): number {
  return Math.max(0, Math.floor(Date.now() / 1_000 - PANGU_EPOCH_SECONDS))
}

// GQNC binds this value into the registration identity but does not apply
// wall-clock expiry. Keeping it deterministic makes retries and imports of the
// same wallet byte-for-byte idempotent; the address and keys provide uniqueness.
const retailAddressAuthorizationTimestamp = 1

export function createGatewayWalletEntryService({
  gateway,
  getWalletRecord,
  timestamp = currentTimestamp,
  confirmationAttempts = 20,
  sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
}: GatewayWalletEntryOptions): WalletEntryService {
  const recover = async () => {
    const record = requireWallet(getWalletRecord)
    const addresses = prepareAddresses(record)
    const [online, groups] = await Promise.all([
      gateway.reOnline(reOnlineMessage(record, addresses)),
      gateway.queryAddressGroups(addresses.map(({ address }) => address)),
    ])
    return {
      reOnline: reOnlineResult(online),
      addressGroupIds: addressGroupIDs(groups, addresses),
    }
  }

  const confirm = async (predicate: (state: Awaited<ReturnType<typeof recover>>) => boolean) => {
    let last: Awaited<ReturnType<typeof recover>> | undefined
    for (let attempt = 0; attempt < Math.max(1, confirmationAttempts); attempt += 1) {
      last = await recover()
      if (predicate(last)) return
      if (attempt + 1 < confirmationAttempts) await sleep(300)
    }
    throw new Error(`网络尚未确认新的组织状态：${JSON.stringify(last ?? {})}`)
  }

  return {
    recover,
    async listOrganizations() {
      const payload = unwrap(await gateway.groups())
      const groups = Array.isArray(payload.groups) ? payload.groups : []
      return groups
        .map((entry) => object(entry))
        .map((entry) => {
          const id = String(entry.group_id ?? entry.GroupID ?? entry.id ?? '').trim()
          const name = String(entry.group_name ?? entry.Name ?? '').trim()
          return id ? { id, name: name || `担保组织 ${id}` } : undefined
        })
        .filter(
          (entry): entry is { id: string; name: string } =>
            !!entry && !['0', '1'].includes(entry.id),
        )
        .sort((left, right) => left.id.localeCompare(right.id))
    },
    async join(groupId) {
      const normalizedGroupID = groupId.trim()
      if (!normalizedGroupID || ['0', '1'].includes(normalizedGroupID))
        throw new Error('请选择有效的担保组织。')
      const record = requireWallet(getWalletRecord)
      const addresses = prepareAddresses(record)
      const response = await gateway.joinGroup(
        normalizedGroupID,
        joinMessage(record, addresses, normalizedGroupID, timestamp()),
      )
      assertAccepted(response, '加入担保组织失败。')
      await confirm(({ reOnline }) => reOnline.isInGroup && reOnline.groupId === normalizedGroupID)
    },
    async registerNoGroup() {
      const record = requireWallet(getWalletRecord)
      const addresses = prepareAddresses(record)
      const accountPublicKey = publicKeyEnvelope(
        walletSecretHex(record.account_private_scalar, '账户私钥'),
      )
      for (const address of addresses) {
        const material = buildRetailAddressOwnershipMaterial({
          address: address.address,
          publicKeyNew: address.publicKeyNew,
          signPublicKeyV2: accountPublicKey,
          seedAnchor: address.seedAnchor,
          seedChainStep: address.seedChainStep,
          defaultSpendAlgorithm: address.defaultSpendAlgorithm,
          type: address.type,
          timestamp: retailAddressAuthorizationTimestamp,
        })
        const signed = signCanonicalMaterial(material, address.privateKey)
        assertAccepted(
          await gateway.registerNoGroupAddress(
            buildRetailAddressRegistrationRequest(material, signed.signature),
          ),
          '独立地址登记失败。',
        )
      }
      let last: string[] = []
      for (let attempt = 0; attempt < Math.max(1, confirmationAttempts); attempt += 1) {
        last = addressGroupIDs(
          await gateway.queryAddressGroups(addresses.map(({ address }) => address)),
          addresses,
        )
        if (last.length === addresses.length && last.every((id) => id === '1')) return
        if (attempt + 1 < confirmationAttempts) await sleep(300)
      }
      throw new Error(`网络尚未接受独立地址登记：${JSON.stringify(last)}`)
    },
  }
}

/** Called once after Pinia installation; wallet secrets are read lazily only while unlocked. */
export function installGatewayWalletEntryService(
  gateway: WalletEntryGatewayPort = new GatewayClient(),
): void {
  configureWalletEntryService(
    createGatewayWalletEntryService({
      gateway,
      getWalletRecord: () => useWalletStore(pinia).unlockedRecord,
    }),
  )
}
