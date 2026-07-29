import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import goEnvelope from '../../tests/fixtures/wallet-keystore-v1-go.json'
import { accountIdFromPrivateScalar, deriveAddressFromRootSeed } from '@/wallet/identity'
import { makeWalletRecord } from '@/wallet/keystore'
import { MemoryWalletRepository } from '@/wallet/repository'

const decryptOffThread = vi.hoisted(() =>
  vi.fn<(envelope: unknown, password: string) => Promise<unknown>>(),
)

vi.mock('@/wallet/unlockWorker', () => ({
  decryptWalletEnvelopeOffThread: decryptOffThread,
}))

import { useWalletStore } from '@/stores/wallet'

describe('wallet backup import execution', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    decryptOffThread.mockReset()
  })

  it('verifies an imported backup outside the UI thread', async () => {
    const privateScalarHex = '02'.repeat(32)
    const rootSeedHex = '01'.repeat(32)
    const record = makeWalletRecord(
      accountIdFromPrivateScalar(privateScalarHex),
      privateScalarHex,
      [
        {
          address: deriveAddressFromRootSeed(rootSeedHex, 0).address,
          type: 0,
          rootSeedHex,
        },
      ],
    )
    decryptOffThread.mockResolvedValue(record)

    const store = useWalletStore()
    store.setRepositoryForTests(new MemoryWalletRepository())
    await store.initialize()

    await store.importEnvelope(goEnvelope, 'backup-password')

    expect(decryptOffThread).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ id: goEnvelope.id }),
      'backup-password',
    )
    expect(store.lifecycle).toBe('unlocked')
  })
})
