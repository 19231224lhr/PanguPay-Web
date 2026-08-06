import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import goEnvelope from '../../tests/fixtures/wallet-keystore-v1-go.json'
import { accountIdFromPrivateScalar, deriveAddressFromRootSeed } from '@/wallet/identity'
import { makeWalletRecord } from '@/wallet/keystore'
import { buildWalletRecoveryKit } from '@/wallet/recovery'
import { MemoryWalletRepository } from '@/wallet/repository'
import { resolveWalletEntry } from '@/wallet/navigation'
import { useWalletStore } from '@/stores/wallet'

describe('wallet lifecycle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('routes absent, locked and unlocked wallets to the correct entry', () => {
    expect(resolveWalletEntry('absent')).toBe('/wallet/setup')
    expect(resolveWalletEntry('locked')).toBe('/wallet/unlock')
    expect(resolveWalletEntry('unlocked')).toBe('/wallet/entry')
  })

  it('initializes an existing envelope as locked and clears secrets on lock', async () => {
    const repository = new MemoryWalletRepository()
    await repository.saveEnvelope(goEnvelope)
    const store = useWalletStore()
    store.setRepositoryForTests(repository)

    await store.initialize()
    expect(store.lifecycle).toBe('locked')

    await store.unlock('correct horse battery staple')
    expect(store.lifecycle).toBe('unlocked')
    expect(store.accountId).toBe('68740417')

    store.lock()
    expect(store.lifecycle).toBe('locked')
    expect(store.accountId).toBe('68740417')
    expect(store.unlockedRecord).toBeUndefined()
  }, 60_000)

  it('does not persist a newly created wallet before backup confirmation', async () => {
    const repository = new MemoryWalletRepository()
    const store = useWalletStore()
    store.setRepositoryForTests(repository)
    await store.initialize()

    await store.create('phase-one-password')
    expect(store.lifecycle).toBe('absent')
    expect(await repository.loadEnvelope()).toBeUndefined()

    await store.confirmCreatedWallet()
    expect(store.lifecycle).toBe('unlocked')
    expect(await repository.loadEnvelope()).toBeDefined()
  }, 60_000)

  it('clears the encrypted wallet only through the explicit destructive action', async () => {
    const repository = new MemoryWalletRepository()
    await repository.saveEnvelope(goEnvelope)
    localStorage.setItem('pangupay-transfer-chain:68740417', 'old-chain')
    localStorage.setItem('pangupay-transfer-journal:68740417', '[{"draftID":"old"}]')
    localStorage.setItem('pangupay-transfer-reservations:68740417', '{"old":["genesis-utxo"]}')
    const store = useWalletStore()
    store.setRepositoryForTests(repository)
    await store.initialize()

    await store.clearLocalWallet()

    expect(store.lifecycle).toBe('absent')
    expect(store.accountId).toBe('')
    expect(await repository.loadEnvelope()).toBeUndefined()
    expect(localStorage.getItem('pangupay-transfer-chain:68740417')).toBeNull()
    expect(localStorage.getItem('pangupay-transfer-journal:68740417')).toBeNull()
    expect(localStorage.getItem('pangupay-transfer-reservations:68740417')).toBeNull()
  })

  it('refuses to replace a locked wallet with recovery material for another account', async () => {
    const repository = new MemoryWalletRepository()
    await repository.saveEnvelope(goEnvelope)
    const store = useWalletStore()
    store.setRepositoryForTests(repository)
    await store.initialize()

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

    await expect(
      store.recoverFromKit(buildWalletRecoveryKit(record), 'new-wallet-password'),
    ).rejects.toThrow('恢复材料不属于当前钱包')
    expect(store.lifecycle).toBe('locked')
    expect((await repository.loadEnvelope())?.id).toBe(goEnvelope.id)
  })
})
