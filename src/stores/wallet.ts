import { computed, markRaw, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { bytesToHex, hexToBytes } from '@/protocol-v2/canonical'
import {
  decryptWalletEnvelope,
  encryptWalletRecord,
  makeWalletRecord,
  parseWalletEnvelope,
} from '@/wallet/keystore'
import {
  accountIdFromPrivateScalar,
  createWalletIdentity,
  deriveAddressFromRootSeed,
} from '@/wallet/identity'
import { IndexedDBWalletRepository, type WalletRepository } from '@/wallet/repository'
import type { WalletKeystoreEnvelope, WalletLifecycle, WalletRecord } from '@/wallet/types'

const AUTO_LOCK_MS = 15 * 60 * 1000

export const useWalletStore = defineStore('wallet', () => {
  const lifecycle = shallowRef<WalletLifecycle>('absent')
  const envelope = shallowRef<WalletKeystoreEnvelope>()
  const unlockedRecord = shallowRef<WalletRecord>()
  const pendingEnvelope = shallowRef<WalletKeystoreEnvelope>()
  const pendingRecord = shallowRef<WalletRecord>()
  const initialized = shallowRef(false)
  const busy = shallowRef(false)
  const error = shallowRef('')
  const repository = shallowRef<WalletRepository>(markRaw(new IndexedDBWalletRepository()))
  let autoLockTimer: ReturnType<typeof setTimeout> | undefined
  let activityBound = false

  const accountId = computed(
    () => unlockedRecord.value?.account_id ?? envelope.value?.public.account_id ?? '',
  )
  const addresses = computed(() => unlockedRecord.value?.addresses ?? [])

  function clearTimer(): void {
    if (autoLockTimer) clearTimeout(autoLockTimer)
    autoLockTimer = undefined
  }

  function lock(): void {
    clearTimer()
    unlockedRecord.value = undefined
    pendingEnvelope.value = undefined
    pendingRecord.value = undefined
    lifecycle.value = envelope.value ? 'locked' : 'absent'
  }

  function touch(): void {
    if (lifecycle.value !== 'unlocked') return
    clearTimer()
    autoLockTimer = setTimeout(lock, AUTO_LOCK_MS)
  }

  function bindActivity(): void {
    if (activityBound || typeof window === 'undefined') return
    activityBound = true
    for (const event of ['pointerdown', 'keydown', 'touchstart'])
      window.addEventListener(event, touch, { passive: true })
  }

  async function initialize(): Promise<void> {
    if (initialized.value) return
    try {
      envelope.value = await repository.value.loadEnvelope()
      lifecycle.value = envelope.value ? 'locked' : 'absent'
      bindActivity()
    } catch {
      lifecycle.value = 'absent'
      error.value = '本地加密钱包损坏，已拒绝自动恢复。'
    } finally {
      initialized.value = true
    }
  }

  async function unlock(password: string): Promise<void> {
    if (!envelope.value) throw new Error('wallet is not configured')
    busy.value = true
    error.value = ''
    try {
      unlockedRecord.value = await decryptWalletEnvelope(envelope.value, password)
      lifecycle.value = 'unlocked'
      touch()
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'wallet unlock failed'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function create(password: string): Promise<WalletKeystoreEnvelope> {
    busy.value = true
    error.value = ''
    try {
      const identity = createWalletIdentity()
      const record = makeWalletRecord(identity.accountId, identity.privateScalarHex, [
        { address: identity.address, type: 0, rootSeedHex: identity.rootSeedHex },
      ])
      const nextEnvelope = await encryptWalletRecord(record, password)
      pendingEnvelope.value = nextEnvelope
      pendingRecord.value = record
      return structuredClone(nextEnvelope)
    } finally {
      busy.value = false
    }
  }

  async function confirmCreatedWallet(): Promise<void> {
    if (!pendingEnvelope.value || !pendingRecord.value)
      throw new Error('wallet creation is not awaiting backup confirmation')
    busy.value = true
    try {
      await repository.value.saveEnvelope(pendingEnvelope.value)
      envelope.value = pendingEnvelope.value
      unlockedRecord.value = pendingRecord.value
      pendingEnvelope.value = undefined
      pendingRecord.value = undefined
      lifecycle.value = 'unlocked'
      touch()
    } finally {
      busy.value = false
    }
  }

  async function importEnvelope(value: unknown, password: string): Promise<void> {
    busy.value = true
    try {
      const parsed = parseWalletEnvelope(value)
      const record = await decryptWalletEnvelope(parsed, password)
      await repository.value.saveEnvelope(parsed)
      pendingEnvelope.value = undefined
      pendingRecord.value = undefined
      envelope.value = parsed
      unlockedRecord.value = record
      lifecycle.value = 'unlocked'
      touch()
    } finally {
      busy.value = false
    }
  }

  async function importLegacy(
    privateScalarHex: string,
    roots: Array<{ type: number; rootSeedHex: string }>,
    password: string,
  ): Promise<WalletKeystoreEnvelope> {
    if (roots.length === 0) throw new Error('缺少 Address RootSeed，无法恢复旧地址。')
    const scalar = bytesToHex(hexToBytes(privateScalarHex))
    if (scalar.length !== 64) throw new Error('账户私钥必须为 32 字节十六进制')
    const account = accountIdFromPrivateScalar(scalar)
    const derived = roots.map((root) => ({
      type: root.type,
      rootSeedHex: root.rootSeedHex,
      address: deriveAddressFromRootSeed(root.rootSeedHex, root.type).address,
    }))
    const record = makeWalletRecord(account, scalar, derived)
    const nextEnvelope = await encryptWalletRecord(record, password)
    await repository.value.saveEnvelope(nextEnvelope)
    pendingEnvelope.value = undefined
    pendingRecord.value = undefined
    envelope.value = nextEnvelope
    unlockedRecord.value = record
    lifecycle.value = 'unlocked'
    touch()
    return structuredClone(nextEnvelope)
  }

  function exportEnvelope(): WalletKeystoreEnvelope {
    if (!envelope.value) throw new Error('wallet is not configured')
    return structuredClone(envelope.value)
  }

  function setRepositoryForTests(next: WalletRepository): void {
    clearTimer()
    repository.value = markRaw(next)
    envelope.value = undefined
    unlockedRecord.value = undefined
    pendingEnvelope.value = undefined
    pendingRecord.value = undefined
    initialized.value = false
    lifecycle.value = 'absent'
    error.value = ''
  }

  return {
    lifecycle,
    initialized,
    busy,
    error,
    accountId,
    addresses,
    unlockedRecord,
    initialize,
    unlock,
    create,
    confirmCreatedWallet,
    importEnvelope,
    importLegacy,
    exportEnvelope,
    lock,
    touch,
    setRepositoryForTests,
  }
})
