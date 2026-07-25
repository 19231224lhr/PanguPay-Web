import { describe, expect, it } from 'vitest'

import { accountIdFromPrivateScalar, deriveAddressFromRootSeed } from '@/wallet/identity'

describe('wallet identity compatibility', () => {
  it('matches the Go account ID and per-address RootSeed vector', () => {
    const scalar = '1f1e1d1c1b1a191817161514131211100f0e0d0c0b0a09080706050403020100'
    const rootSeed = 'a0a1a2a3a4a5a6a7a8a9aaabacadaeafb0b1b2b3b4b5b6b7b8b9babbbcbdbebf'

    expect(accountIdFromPrivateScalar(scalar)).toBe('68740417')
    expect(deriveAddressFromRootSeed(rootSeed, 0).address).toBe(
      'b14c4c4ccba12b08809c7cbb58c202f17dd25b2d',
    )
  })

  it('rejects invalid scalars and RootSeeds instead of guessing', () => {
    expect(() => accountIdFromPrivateScalar('00')).toThrow('private scalar')
    expect(() => deriveAddressFromRootSeed('abcd', 0)).toThrow('RootSeed')
  })
})
