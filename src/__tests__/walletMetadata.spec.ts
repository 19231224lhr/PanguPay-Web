import { describe, expect, it } from 'vitest'

import { MemoryWalletRepository } from '@/wallet/repository'
import type { WalletPublicMetadata } from '@/wallet/types'

describe('wallet public metadata', () => {
  it('persists profile and address metadata without touching the encrypted envelope', async () => {
    const repository = new MemoryWalletRepository()
    const metadata: WalletPublicMetadata = {
      version: 1,
      accountId: '47065319',
      profile: { displayName: 'Alice', avatarDataUrl: 'data:image/webp;base64,AAAA' },
      addresses: {
        abc: {
          label: '日常支付',
          archived: false,
          registration: 'active',
        },
      },
    }

    await repository.saveMetadata(metadata)

    expect(await repository.loadMetadata('47065319')).toEqual(metadata)
    expect(await repository.loadEnvelope()).toBeUndefined()
  })

  it('returns no metadata for another account and clears metadata explicitly', async () => {
    const repository = new MemoryWalletRepository()
    await repository.saveMetadata({
      version: 1,
      accountId: '47065319',
      profile: { displayName: 'Alice' },
      addresses: {},
    })

    expect(await repository.loadMetadata('another-account')).toBeUndefined()
    await repository.clear()
    expect(await repository.loadMetadata('47065319')).toBeUndefined()
  })
})
