import { ec as EC } from 'elliptic'

import { bytesToHex, decodeBackendBytes, hexToBytes, sha256Bytes } from '@/protocol-v2/canonical'
import type { BackendBytes } from '@/protocol-v2/types'

const ec = new EC('p256')
const encoder = new TextEncoder()
const P256_ORDER = BigInt('0xffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551')
const SEED_DOMAIN = 'pangu-seedchain-v2'

export const DEFAULT_SEED_CHAIN_LENGTH = 1000
export const DEFAULT_SEED_RECOVERY_GENERATION_WINDOW = 2048

export interface SeedRecoveryOptions {
  chainLength?: number
  maxGeneration?: number
}

export interface RecoveredSeedReveal {
  seedReveal: number[]
  generation: number
}

export interface SeedSpendArtifacts {
  InputSignatureV2: {
    Algorithm: 'ecdsa_p256'
    Signature: number[]
  }
  SeedReveal: number[]
  SeedPublicKeyV2: {
    Algorithm: 'ecdsa_p256'
    PublicKey: number[]
  }
  SeedChainStep: number
}

function normalizePrivateScalar(privateKeyHex: string): number[] {
  const value = String(privateKeyHex || '')
    .trim()
    .replace(/^0x/i, '')
    .toLowerCase()
  if (!/^[0-9a-f]{1,64}$/.test(value)) throw new Error('invalid P-256 private scalar')

  const scalar = BigInt(`0x${value}`)
  if (scalar <= 0n || scalar >= P256_ORDER) throw new Error('invalid P-256 private scalar')
  return hexToBytes(value.padStart(64, '0'))
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${name} must be a positive integer`)
  return value
}

function seedRevealForGeneration(
  privateScalar: number[],
  generation: number,
  step: number,
): number[] {
  const domain = encoder.encode(`${SEED_DOMAIN}:${generation}:`)
  const masterSeed = sha256Bytes([...domain, ...privateScalar])
  let reveal = sha256Bytes(masterSeed)
  for (let index = 0; index < step; index += 1) reveal = sha256Bytes(reveal)
  return reveal
}

function bytesEqual(left: ArrayLike<number>, right: ArrayLike<number>): boolean {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

export function recoverSeedReveal(
  privateKeyHex: string,
  outputSeedAnchor: BackendBytes,
  outputSeedStep: number,
  options: SeedRecoveryOptions = {},
): RecoveredSeedReveal {
  if (!Number.isSafeInteger(outputSeedStep) || outputSeedStep <= 0)
    throw new Error('seed chain exhausted')

  const chainLength = positiveInteger(
    options.chainLength ?? DEFAULT_SEED_CHAIN_LENGTH,
    'chainLength',
  )
  if (outputSeedStep > chainLength)
    throw new Error(`step ${outputSeedStep} out of range [1, ${chainLength}]`)

  const anchor = decodeBackendBytes(outputSeedAnchor)
  if (anchor.length !== 32) throw new Error('invalid seed anchor')

  const configuredGenerationWindow = options.maxGeneration
  const maxGeneration =
    configuredGenerationWindow == null || configuredGenerationWindow < 0
      ? DEFAULT_SEED_RECOVERY_GENERATION_WINDOW
      : configuredGenerationWindow
  if (!Number.isSafeInteger(maxGeneration)) throw new Error('invalid generation window')

  const privateScalar = normalizePrivateScalar(privateKeyHex)
  for (let generation = 0; generation <= maxGeneration; generation += 1) {
    const seedReveal = seedRevealForGeneration(privateScalar, generation, outputSeedStep)
    if (bytesEqual(sha256Bytes(seedReveal), anchor)) return { seedReveal, generation }
  }

  throw new Error(`anchor mismatch at step ${outputSeedStep}`)
}

export function deriveP256PrivateKeyHexFromSeed(seedReveal: BackendBytes): string {
  const seed = decodeBackendBytes(seedReveal)
  if (seed.length < 32) throw new Error(`seed too short (${seed.length} bytes)`)

  const value = BigInt(`0x${bytesToHex(seed)}`)
  return ((value % (P256_ORDER - 1n)) + 1n).toString(16).padStart(64, '0')
}

export function buildSeedSpendArtifacts(
  outputHash: ArrayLike<number>,
  privateKeyHex: string,
  outputSeedAnchor: BackendBytes,
  outputSeedStep: number,
  options: SeedRecoveryOptions = {},
): SeedSpendArtifacts {
  const normalizedOutputHash = Array.from(outputHash)
  if (normalizedOutputHash.length !== 32) throw new Error('referenced output hash must be 32 bytes')

  const { seedReveal } = recoverSeedReveal(privateKeyHex, outputSeedAnchor, outputSeedStep, options)
  const oneTimeKey = ec.keyFromPrivate(deriveP256PrivateKeyHexFromSeed(seedReveal), 'hex')

  return {
    InputSignatureV2: {
      Algorithm: 'ecdsa_p256',
      Signature: oneTimeKey.sign(normalizedOutputHash).toDER(),
    },
    SeedReveal: seedReveal,
    SeedPublicKeyV2: {
      Algorithm: 'ecdsa_p256',
      PublicKey: hexToBytes(oneTimeKey.getPublic().encode('hex', false)),
    },
    SeedChainStep: outputSeedStep,
  }
}
