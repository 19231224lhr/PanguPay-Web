import { ec as EC } from 'elliptic'

import { bytesToHex, hexToBytes, sha256Bytes } from './canonical'

const ec = new EC('p256')
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const PAYLOAD_BYTES = 84
const MASK_BYTES = 20
const SIGNATURE_BYTES = 32
const MASK_DOMAIN = new TextEncoder().encode('PANGU_CAPSULE_V1')
const MAX_CAPSULE_LENGTH = 160

export const COMMITTEE_CAPSULE_ORG_ID = '00000000'

export interface CapsulePublicKey {
  CurveName: string
  X: bigint | number | string
  Y: bigint | number | string
}

export interface ParsedCapsuleAddress {
  orgID: string
  payload: string
}

export interface VerifiedCapsuleAddress {
  address: string
  orgID: string
}

function concatBytes(...parts: ArrayLike<number>[]): number[] {
  return parts.flatMap((part) => Array.from(part))
}

function equalBytes(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  const a = Array.from(left)
  const b = Array.from(right)
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function decodeBase58(value: string): number[] {
  if (!value || value.length > MAX_CAPSULE_LENGTH) throw new Error('胶囊地址格式无效。')
  let result = 0n
  for (const character of value) {
    const digit = ALPHABET.indexOf(character)
    if (digit < 0) throw new Error('胶囊地址格式无效。')
    result = result * 58n + BigInt(digit)
  }
  const bytes: number[] = []
  while (result > 0n) {
    bytes.unshift(Number(result & 0xffn))
    result >>= 8n
  }
  for (let index = 0; index < value.length && value[index] === '1'; index += 1) bytes.unshift(0)
  return bytes
}

function decodeBase58Check(value: string): number[] {
  const decoded = decodeBase58(value)
  if (decoded.length < 5) throw new Error('胶囊地址格式无效。')
  const payload = decoded.slice(0, -4)
  const checksum = decoded.slice(-4)
  const expected = sha256Bytes(sha256Bytes(payload)).slice(0, 4)
  if (!equalBytes(checksum, expected)) throw new Error('胶囊地址校验和无效。')
  return payload
}

function coordinate(value: CapsulePublicKey['X']): string {
  const number = BigInt(value)
  if (number <= 0n) throw new Error('胶囊签名公钥无效。')
  const hex = number.toString(16)
  if (hex.length > 64) throw new Error('胶囊签名公钥无效。')
  return hex.padStart(64, '0')
}

export function parseCapsuleAddress(input: string): ParsedCapsuleAddress {
  const value = String(input ?? '').trim()
  if (value.length > MAX_CAPSULE_LENGTH) throw new Error('胶囊地址格式无效。')
  const separator = value.indexOf('@')
  if (separator !== 8 || value.indexOf('@', separator + 1) >= 0)
    throw new Error('胶囊地址格式无效。')
  const orgID = value.slice(0, separator)
  const payload = value.slice(separator + 1)
  if (!/^\d{8}$/.test(orgID) || !payload) throw new Error('胶囊地址格式无效。')
  if (decodeBase58Check(payload).length !== PAYLOAD_BYTES) throw new Error('胶囊地址载荷长度无效。')
  return { orgID, payload }
}

export function isCapsuleAddress(input: string): boolean {
  try {
    parseCapsuleAddress(input)
    return true
  } catch {
    return false
  }
}

export function verifyCapsuleAddress(
  input: string,
  publicKey: CapsulePublicKey,
): VerifiedCapsuleAddress {
  const { orgID, payload } = parseCapsuleAddress(input)
  const curve = String(publicKey?.CurveName ?? '')
    .toUpperCase()
    .replace(/[-_]/g, '')
  if (curve !== 'P256') throw new Error('胶囊签名公钥曲线无效。')

  const x = coordinate(publicKey.X)
  const y = coordinate(publicKey.Y)
  let key: ReturnType<typeof ec.keyFromPublic>
  try {
    key = ec.keyFromPublic({ x, y }, 'hex')
    if (!key.getPublic().validate()) throw new Error('invalid point')
  } catch {
    throw new Error('胶囊签名公钥无效。')
  }

  const bytes = decodeBase58Check(payload)
  const maskedAddress = bytes.slice(0, MASK_BYTES)
  const r = bytesToHex(bytes.slice(MASK_BYTES, MASK_BYTES + SIGNATURE_BYTES))
  const s = bytesToHex(bytes.slice(MASK_BYTES + SIGNATURE_BYTES))
  const digest = bytesToHex(sha256Bytes(maskedAddress))
  if (!key.verify(digest, { r, s })) throw new Error('胶囊地址签名验证失败。')

  const mask = sha256Bytes(concatBytes(hexToBytes(x), hexToBytes(y), MASK_DOMAIN)).slice(
    0,
    MASK_BYTES,
  )
  const address = bytesToHex(maskedAddress.map((byte, index) => byte ^ mask[index]!))
  if (!/^[0-9a-f]{40}$/.test(address)) throw new Error('胶囊地址还原失败。')
  return { address, orgID }
}
