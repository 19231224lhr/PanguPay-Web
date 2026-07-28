import { describe, expect, it } from 'vitest'

import { bytesToBase64, hexToBytes } from '@/protocol-v2/canonical'
import { makeWalletRecord } from '@/wallet/keystore'
import { buildWalletRecoveryKit, parseWalletRecoveryKit } from '@/wallet/recovery'

const PRIVATE_SCALAR = '1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100'
const ROOT_SEED = 'a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf'
const ADDRESS = 'b14c4c4ccba12b08809c7cbb58c202f17dd25b2d'

function record() {
  return makeWalletRecord('68740417', PRIVATE_SCALAR, [
    { address: ADDRESS, type: 0, rootSeedHex: ROOT_SEED },
  ])
}

describe('wallet recovery kit v1', () => {
  it('round-trips every secret required to rebuild the same wallet', () => {
    const kit = buildWalletRecoveryKit(record())

    expect(kit.version).toBe(1)
    expect(kit.kind).toBe('pangu-wallet-recovery')
    expect(parseWalletRecoveryKit(kit).wallet).toEqual(record())
  })

  it('rejects a private scalar or RootSeed that no longer derives the recorded identity', () => {
    const privateKeyTamper = structuredClone(buildWalletRecoveryKit(record()))
    privateKeyTamper.wallet.account_private_scalar = bytesToBase64(hexToBytes('01'.repeat(32)))
    expect(() => parseWalletRecoveryKit(privateKeyTamper)).toThrow(
      'account ID does not match private scalar',
    )

    const rootSeedTamper = structuredClone(buildWalletRecoveryKit(record()))
    rootSeedTamper.wallet.addresses[0]!.root_seed = bytesToBase64(hexToBytes('00'.repeat(32)))
    expect(() => parseWalletRecoveryKit(rootSeedTamper)).toThrow('address does not match RootSeed')
  })

  it('rejects unsupported fields instead of guessing a recovery format', () => {
    expect(() =>
      parseWalletRecoveryKit({ ...buildWalletRecoveryKit(record()), password: 'secret' }),
    ).toThrow('recovery kit has unsupported fields')
  })
})
