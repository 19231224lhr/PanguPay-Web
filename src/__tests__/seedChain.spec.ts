import { describe, expect, it } from 'vitest'

import {
  bytesToHex,
  hexToBytes,
  sha256Bytes,
  verifySignatureEnvelopeV2,
} from '@/protocol-v2/canonical'
import {
  buildSeedSpendArtifacts,
  deriveP256PrivateKeyHexFromSeed,
  recoverSeedReveal,
} from '@/transfer/seedChain'

const PRIVATE_KEY = '6fc662ab3d9cf5b1a7f08f30a1237f1ab8b5d33a36feeb48c8895ac2577b01b6'
const ANCHOR = '9ee1f74fdae5b288ac9f6c82f102748fb5710ec388f56fccbbf313e67031ea80'
const REVEAL = '457e2acbbd30103058511e03d043aaf2895924521da45e1edf08639168140f8a'
const DERIVED_PRIVATE = '457e2acbbd30103058511e03d043aaf2895924521da45e1edf08639168140f8b'
const DERIVED_PUBLIC =
  '04fb7d41e354282930a0ef52c1f281593ca87cfd4dc1315ef4a875bcb37bd89984beb3e71bde5c459be1e5b4e6124a13ee3524e1a82173daf4f68239e459fc5ebd'

describe('seed-chain input signing', () => {
  it('recovers the Go-compatible reveal across deterministic generations', () => {
    const recovered = recoverSeedReveal(PRIVATE_KEY, hexToBytes(ANCHOR), 2, {
      chainLength: 4,
      maxGeneration: 2,
    })

    expect(recovered.generation).toBe(1)
    expect(bytesToHex(recovered.seedReveal)).toBe(REVEAL)
    expect(bytesToHex(sha256Bytes(recovered.seedReveal))).toBe(ANCHOR)
  })

  it('derives the same one-time P-256 scalar as Go', () => {
    expect(deriveP256PrivateKeyHexFromSeed(hexToBytes(REVEAL))).toBe(DERIVED_PRIVATE)
  })

  it('builds a verifiable V2 input signature bound to the output hash', () => {
    const outputHash = sha256Bytes('referenced-output')
    const artifacts = buildSeedSpendArtifacts(outputHash, PRIVATE_KEY, hexToBytes(ANCHOR), 2, {
      chainLength: 4,
      maxGeneration: 2,
    })

    expect(artifacts.SeedChainStep).toBe(2)
    expect(bytesToHex(artifacts.SeedReveal)).toBe(REVEAL)
    expect(bytesToHex(artifacts.SeedPublicKeyV2.PublicKey!)).toBe(DERIVED_PUBLIC)
    expect(
      verifySignatureEnvelopeV2(outputHash, artifacts.InputSignatureV2, artifacts.SeedPublicKeyV2),
    ).toBe(true)
    expect(
      verifySignatureEnvelopeV2(
        sha256Bytes('different-output'),
        artifacts.InputSignatureV2,
        artifacts.SeedPublicKeyV2,
      ),
    ).toBe(false)
  })

  it('fails closed for exhausted steps and mismatched anchors', () => {
    expect(() => recoverSeedReveal(PRIVATE_KEY, hexToBytes(ANCHOR), 0, { chainLength: 4 })).toThrow(
      'seed chain exhausted',
    )
    expect(() =>
      recoverSeedReveal(
        PRIVATE_KEY,
        Array.from({ length: 32 }, () => 0),
        2,
        {
          chainLength: 4,
          maxGeneration: 2,
        },
      ),
    ).toThrow('anchor mismatch')
  })
})
