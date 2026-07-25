import { argon2idAsync } from '@noble/hashes/argon2.js'

import { bytesToBase64, bytesToHex, hexToBytes } from '@/protocol-v2/canonical'
import { accountIdFromPrivateScalar, deriveAddressFromRootSeed } from '@/wallet/identity'
import type { WalletAddressRecord, WalletKeystoreEnvelope, WalletRecord } from '@/wallet/types'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PASSWORD_MIN_BYTES = 12

function rawBase64(bytes: ArrayLike<number>): string {
  return bytesToBase64(Array.from(bytes)).replace(/=+$/, '')
}

function arrayBuffer(bytes: ArrayLike<number>): ArrayBuffer {
  return Uint8Array.from(bytes).buffer
}

function decodeBase64(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1)
    throw new Error('invalid base64')
  const normalized = value + '='.repeat((4 - (value.length % 4)) % 4)
  const binary = atob(normalized)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function assertPassword(password: string): Uint8Array {
  const bytes = encoder.encode(password)
  if (bytes.length < PASSWORD_MIN_BYTES || bytes.length > 1024)
    throw new Error('password must contain between 12 and 1024 UTF-8 bytes')
  return bytes
}

function exactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new Error(`${label} has unsupported fields`)
}

export function parseWalletEnvelope(value: unknown): WalletKeystoreEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('wallet keystore must be an object')
  const envelope = value as Record<string, unknown>
  exactKeys(envelope, ['version', 'kind', 'id', 'public', 'crypto', 'ciphertext'], 'envelope')
  const publicRecord = envelope.public as Record<string, unknown>
  const cryptoRecord = envelope.crypto as Record<string, unknown>
  const kdf = cryptoRecord?.kdf as Record<string, unknown>
  exactKeys(publicRecord, ['account_id'], 'public metadata')
  exactKeys(cryptoRecord, ['kdf', 'nonce'], 'crypto metadata')
  exactKeys(kdf, ['name', 'time', 'memory_kib', 'threads', 'key_len', 'salt'], 'KDF')
  if (
    envelope.version !== 1 ||
    envelope.kind !== 'wallet' ||
    typeof envelope.id !== 'string' ||
    !envelope.id ||
    publicRecord.account_id !== envelope.id ||
    kdf.name !== 'argon2id' ||
    kdf.time !== 3 ||
    kdf.memory_kib !== 65536 ||
    kdf.threads !== 4 ||
    kdf.key_len !== 32 ||
    typeof kdf.salt !== 'string' ||
    typeof cryptoRecord.nonce !== 'string' ||
    typeof envelope.ciphertext !== 'string'
  )
    throw new Error('unsupported wallet keystore parameters')
  if (
    decodeBase64(kdf.salt).length !== 16 ||
    decodeBase64(cryptoRecord.nonce as string).length !== 12 ||
    decodeBase64(envelope.ciphertext).length < 17
  )
    throw new Error('invalid wallet keystore byte lengths')
  return structuredClone(value) as WalletKeystoreEnvelope
}

function walletAAD(envelope: WalletKeystoreEnvelope): Uint8Array {
  return encoder.encode(
    JSON.stringify({
      version: envelope.version,
      kind: envelope.kind,
      id: envelope.id,
      public: { account_id: envelope.public.account_id },
    }),
  )
}

function validateWalletRecord(record: WalletRecord): WalletRecord {
  exactKeys(
    record as unknown as Record<string, unknown>,
    ['account_id', 'account_private_scalar', 'addresses'],
    'wallet record',
  )
  const scalar = decodeBase64(record.account_private_scalar)
  if (scalar.length !== 32) throw new Error('account private scalar must be 32 bytes')
  const scalarHex = bytesToHex(scalar)
  if (accountIdFromPrivateScalar(scalarHex) !== record.account_id)
    throw new Error('account ID does not match private scalar')
  if (!Array.isArray(record.addresses) || record.addresses.length === 0)
    throw new Error('wallet must contain at least one address')
  const seen = new Set<string>()
  for (const address of record.addresses) {
    exactKeys(
      address as unknown as Record<string, unknown>,
      ['address', 'type', 'root_seed'],
      'wallet address',
    )
    const type = Number(address.type)
    const rootSeed = decodeBase64(address.root_seed)
    if (
      !address.address ||
      !/^\d+$/.test(address.type) ||
      !Number.isSafeInteger(type) ||
      rootSeed.length !== 32
    )
      throw new Error('invalid wallet address')
    const derived = deriveAddressFromRootSeed(bytesToHex(rootSeed), type).address
    if (derived !== address.address.toLowerCase())
      throw new Error('address does not match RootSeed')
    if (seen.has(address.address)) throw new Error('duplicate wallet address')
    seen.add(address.address)
  }
  return structuredClone(record)
}

async function deriveKey(password: string, salt: Uint8Array): Promise<Uint8Array> {
  return argon2idAsync(assertPassword(password), salt, {
    t: 3,
    m: 65536,
    p: 4,
    dkLen: 32,
    asyncTick: 8,
    maxmem: 96 * 1024 * 1024,
  })
}

export async function decryptWalletEnvelope(
  envelopeValue: WalletKeystoreEnvelope,
  password: string,
): Promise<WalletRecord> {
  const envelope = parseWalletEnvelope(envelopeValue)
  try {
    const salt = decodeBase64(envelope.crypto.kdf.salt)
    const keyBytes = await deriveKey(password, salt)
    const key = await crypto.subtle.importKey('raw', arrayBuffer(keyBytes), 'AES-GCM', false, [
      'decrypt',
    ])
    const plaintext = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: arrayBuffer(decodeBase64(envelope.crypto.nonce)),
        additionalData: arrayBuffer(walletAAD(envelope)),
      },
      key,
      arrayBuffer(decodeBase64(envelope.ciphertext)),
    )
    const parsed = JSON.parse(decoder.decode(plaintext)) as WalletRecord
    return validateWalletRecord(parsed)
  } catch {
    throw new Error('wallet unlock failed')
  }
}

export async function encryptWalletRecord(
  recordValue: WalletRecord,
  password: string,
): Promise<WalletKeystoreEnvelope> {
  assertPassword(password)
  const record = validateWalletRecord(recordValue)
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const envelope: WalletKeystoreEnvelope = {
    version: 1,
    kind: 'wallet',
    id: record.account_id,
    public: { account_id: record.account_id },
    crypto: {
      kdf: {
        name: 'argon2id',
        time: 3,
        memory_kib: 65536,
        threads: 4,
        key_len: 32,
        salt: rawBase64(salt),
      },
      nonce: rawBase64(nonce),
    },
    ciphertext: '',
  }
  const keyBytes = await deriveKey(password, salt)
  const key = await crypto.subtle.importKey('raw', arrayBuffer(keyBytes), 'AES-GCM', false, [
    'encrypt',
  ])
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: arrayBuffer(nonce), additionalData: arrayBuffer(walletAAD(envelope)) },
    key,
    encoder.encode(JSON.stringify(record)),
  )
  envelope.ciphertext = rawBase64(new Uint8Array(ciphertext))
  return envelope
}

export function makeWalletRecord(
  accountId: string,
  privateScalarHex: string,
  addresses: Array<{ address: string; type: number; rootSeedHex: string }>,
): WalletRecord {
  return validateWalletRecord({
    account_id: accountId,
    account_private_scalar: bytesToBase64(hexToBytes(privateScalarHex)),
    addresses: addresses.map<WalletAddressRecord>((address) => ({
      address: address.address.toLowerCase(),
      type: String(address.type),
      root_seed: bytesToBase64(hexToBytes(address.rootSeedHex)),
    })),
  })
}
