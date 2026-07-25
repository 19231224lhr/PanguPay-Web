import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import goEnvelope from '../../tests/fixtures/wallet-keystore-v1-go.json'
import { MemoryWalletRepository } from '@/wallet/repository'
import { resolveWalletEntry } from '@/wallet/navigation'
import { useWalletStore } from '@/stores/wallet'

describe('wallet lifecycle', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('routes absent, locked and unlocked wallets to the correct entry', () => {
    expect(resolveWalletEntry('absent')).toBe('/wallet/setup')
    expect(resolveWalletEntry('locked')).toBe('/wallet/unlock')
    expect(resolveWalletEntry('unlocked')).toBe('/wallet')
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
})
