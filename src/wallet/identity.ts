import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { ec as EC } from 'elliptic'

import { bytesToHex, hexToBytes } from '@/protocol-v2/canonical'

const ADDRESS_ROOT_DOMAIN = new TextEncoder().encode('utxo-address-root-seed:v1')
const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')
const ec = new EC('p256')

function scalarFromHex(value: string): { bytes: Uint8Array; integer: bigint } {
  const text = value.trim().replace(/^0x/i, '').toLowerCase()
  if (!/^[0-9a-f]{64}$/.test(text)) throw new Error('private scalar must be exactly 32 bytes')
  const integer = BigInt(`0x${text}`)
  if (integer <= 0n || integer >= P256_ORDER) throw new Error('private scalar is out of range')
  return { bytes: Uint8Array.from(hexToBytes(text)), integer }
}

function crc32(input: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of input) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function accountIdFromPrivateScalar(privateScalarHex: string): string {
  const { bytes } = scalarFromHex(privateScalarHex)
  const goPrivateHex = bytesToHex(bytes).replace(/^0+/, '') || '0'
  return String((crc32(new TextEncoder().encode(goPrivateHex)) % 90_000_000) + 10_000_000)
}

export function deriveAddressFromRootSeed(
  rootSeedHex: string,
  addressType: number,
): { address: string; privateScalarHex: string; publicKeyHex: string } {
  const rootSeed = Uint8Array.from(hexToBytes(rootSeedHex))
  if (rootSeed.length !== 32) throw new Error('address RootSeed must be exactly 32 bytes')
  if (!Number.isInteger(addressType) || addressType < 0 || addressType > 0xffffffff)
    throw new Error('invalid address type')

  const typeBytes = new Uint8Array(4)
  new DataView(typeBytes.buffer).setUint32(0, addressType, false)
  const material = new Uint8Array(ADDRESS_ROOT_DOMAIN.length + 4)
  material.set(ADDRESS_ROOT_DOMAIN)
  material.set(typeBytes, ADDRESS_ROOT_DOMAIN.length)
  const digest = hmac(sha256, rootSeed, material)
  const scalar = (BigInt(`0x${bytesToHex(digest)}`) % (P256_ORDER - 1n)) + 1n
  const privateScalarHex = scalar.toString(16).padStart(64, '0')
  const publicKey = Uint8Array.from(
    ec.keyFromPrivate(privateScalarHex, 'hex').getPublic().encode('array', false),
  )
  const address = bytesToHex(sha256(publicKey).slice(0, 20))
  return { address, privateScalarHex, publicKeyHex: bytesToHex(publicKey) }
}

export function generatePrivateScalarHex(): string {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const value = BigInt(`0x${bytesToHex(bytes)}`)
    if (value > 0n && value < P256_ORDER) return bytesToHex(bytes)
  }
}

export function generateRootSeedHex(): string {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
}

export function createWalletIdentity(): {
  accountId: string
  privateScalarHex: string
  rootSeedHex: string
  address: string
} {
  const privateScalarHex = generatePrivateScalarHex()
  const rootSeedHex = generateRootSeedHex()
  const accountId = accountIdFromPrivateScalar(privateScalarHex)
  const { address } = deriveAddressFromRootSeed(rootSeedHex, 0)
  return { accountId, privateScalarHex, rootSeedHex, address }
}
