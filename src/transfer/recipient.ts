import { decodeBackendBytes, publicKey } from '@/protocol-v2/canonical'
import type { PublicKeyV2 } from '@/protocol-v2/types'

export interface RecipientSpendMetadata {
  address: string
  groupID: string
  publicKey: PublicKeyV2
  coinType: number
  seedAnchor: number[]
  seedChainStep: number
  defaultSpendAlgorithm: string
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function resolveRecipientSpendMetadata(
  rawAddress: string,
  response: unknown,
): RecipientSpendMetadata {
  const address = rawAddress.trim().replace(/^0x/i, '').toLowerCase()
  if (!/^[0-9a-f]{40}$/.test(address)) throw new Error('recipient address is invalid')
  const root = object(response)
  const mapping = object(root?.Addresstogroup)
  const value = object(mapping?.[address] ?? mapping?.[rawAddress])
  if (!value) throw new Error('recipient is not registered')
  const key = publicKey(value.PublicKey as PublicKeyV2)
  const x = key.X
  const y = key.Y
  if (x == null || y == null || x <= 0n || y <= 0n)
    throw new Error('recipient public key is incomplete')
  const seedAnchor = decodeBackendBytes(value.SeedAnchor as string | number[])
  const seedChainStep = Number(value.SeedChainStep ?? 0)
  const algorithm = String(value.DefaultSpendAlgorithm ?? '')
  if (
    !seedAnchor.length ||
    !Number.isSafeInteger(seedChainStep) ||
    seedChainStep <= 0 ||
    !algorithm
  )
    throw new Error('recipient seed metadata is incomplete')
  const rawGroupID = String(value.GroupID ?? '').trim()
  return {
    address,
    groupID: rawGroupID === '1' || rawGroupID === 'nogroup' ? '' : rawGroupID,
    publicKey: { CurveName: key.CurveName, X: x, Y: y },
    coinType: Number(value.Type ?? 0),
    seedAnchor,
    seedChainStep,
    defaultSpendAlgorithm: algorithm,
  }
}
