import { describe, expect, it } from 'vitest'

import goEnvelope from '../../tests/fixtures/wallet-keystore-v1-go.json'
import {
  decryptWalletEnvelope,
  encryptWalletRecord,
  makeWalletRecord,
  parseWalletEnvelope,
} from '@/wallet/keystore'

const PRIVATE_SCALAR = '1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100'
const ROOT_SEED = 'a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf'
const ADDRESS = 'b14c4c4ccba12b08809c7cbb58c202f17dd25b2d'

describe('wallet keystore v1', () => {
  it('decrypts the Go-generated Argon2id/AES-GCM vector', async () => {
    const record = await decryptWalletEnvelope(
      parseWalletEnvelope(goEnvelope),
      'correct horse battery staple',
    )

    expect(record.account_id).toBe('68740417')
    expect(record.addresses).toEqual([
      {
        address: 'b14c4c4ccba12b08809c7cbb58c202f17dd25b2d',
        type: '0',
        root_seed: 'oKGio6SlpqeoqaqrrK2ur7CxsrO0tba3uLm6u7y9vr8=',
      },
    ])
  }, 60_000)

  it('fails closed when the envelope shape is changed', () => {
    expect(() => parseWalletEnvelope({ ...goEnvelope, kind: 'node' })).toThrow(
      'unsupported wallet keystore',
    )
    expect(() =>
      parseWalletEnvelope({
        ...goEnvelope,
        crypto: { ...goEnvelope.crypto, kdf: { ...goEnvelope.crypto.kdf, time: 1 } },
      }),
    ).toThrow('unsupported wallet keystore')
  })

  it('round-trips a TypeScript envelope and rejects a wrong password or tampering', async () => {
    const record = makeWalletRecord('68740417', PRIVATE_SCALAR, [
      { address: ADDRESS, type: 0, rootSeedHex: ROOT_SEED },
    ])
    const envelope = await encryptWalletRecord(record, 'phase-one-password')

    await expect(decryptWalletEnvelope(envelope, 'phase-one-password')).resolves.toEqual(record)
    await expect(decryptWalletEnvelope(envelope, 'wrong-password-value')).rejects.toThrow(
      'wallet unlock failed',
    )

    const tampered = structuredClone(envelope)
    tampered.ciphertext =
      (tampered.ciphertext.startsWith('A') ? 'B' : 'A') + tampered.ciphertext.slice(1)
    await expect(decryptWalletEnvelope(tampered, 'phase-one-password')).rejects.toThrow(
      'wallet unlock failed',
    )
  }, 120_000)

  it('rejects a RootSeed that does not derive the recorded address', () => {
    expect(() =>
      makeWalletRecord('68740417', PRIVATE_SCALAR, [
        { address: ADDRESS, type: 0, rootSeedHex: '00'.repeat(32) },
      ]),
    ).toThrow('address does not match RootSeed')
  })
})
