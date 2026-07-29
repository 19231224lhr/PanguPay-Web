import { computed, markRaw, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { bytesToBase64, bytesToHex, hexToBytes } from '@/protocol-v2/canonical'
import { clearTransferJournal } from '@/transfer/journal'
import { clearTransferReservations } from '@/transfer/reservations'
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
  generateRootSeedHex,
} from '@/wallet/identity'
import { IndexedDBWalletRepository, type WalletRepository } from '@/wallet/repository'
import { buildWalletRecoveryKit, parseWalletRecoveryKit } from '@/wallet/recovery'
import { decryptWalletEnvelopeOffThread } from '@/wallet/unlockWorker'
import type {
  WalletKeystoreEnvelope,
  WalletLifecycle,
  WalletPublicMetadata,
  WalletRecord,
  WalletRecoveryKit,
} from '@/wallet/types'

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
  const metadata = shallowRef<WalletPublicMetadata>()
  const repository = shallowRef<WalletRepository>(markRaw(new IndexedDBWalletRepository()))
  let autoLockTimer: ReturnType<typeof setTimeout> | undefined
  let activityBound = false

  const accountId = computed(
    () => unlockedRecord.value?.account_id ?? envelope.value?.public.account_id ?? '',
  )
  const addresses = computed(() => unlockedRecord.value?.addresses ?? [])
  const activeAddresses = computed(() =>
    addresses.value.filter((address) => !metadata.value?.addresses[address.address]?.archived),
  )
  const activeRecord = computed<WalletRecord | undefined>(() =>
    unlockedRecord.value
      ? { ...unlockedRecord.value, addresses: activeAddresses.value }
      : undefined,
  )
  const profile = computed(
    () => metadata.value?.profile ?? { displayName: accountId.value || 'PanguPay' },
  )

  function fallbackDisplayName(id: string): string {
    return id ? `${id.slice(0, 4)} ${id.slice(4)}` : 'PanguPay'
  }

  function withAddressDefaults(
    current: WalletPublicMetadata | undefined,
    record: WalletRecord,
  ): WalletPublicMetadata {
    const addresses = { ...current?.addresses }
    for (const address of record.addresses) {
      addresses[address.address] ??= {
        label: `地址 ${Object.keys(addresses).length + 1}`,
        archived: false,
        registration: 'active',
      }
    }
    return {
      version: 1,
      accountId: record.account_id,
      profile: current?.profile ?? { displayName: fallbackDisplayName(record.account_id) },
      addresses,
    }
  }

  async function loadMetadata(id: string): Promise<void> {
    metadata.value = id ? await repository.value.loadMetadata(id) : undefined
  }

  async function persistMetadata(next: WalletPublicMetadata): Promise<void> {
    await repository.value.saveMetadata(next)
    metadata.value = structuredClone(next)
  }

  async function ensureMetadata(record: WalletRecord): Promise<void> {
    const current =
      metadata.value?.accountId === record.account_id
        ? metadata.value
        : await repository.value.loadMetadata(record.account_id)
    await persistMetadata(withAddressDefaults(current, record))
  }

  function clearTimer(): void {
    if (autoLockTimer) clearTimeout(autoLockTimer)
    autoLockTimer = undefined
  }

  function clearError(): void {
    error.value = ''
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
      await loadMetadata(envelope.value?.public.account_id ?? '')
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
      unlockedRecord.value = await decryptWalletEnvelopeOffThread(envelope.value, password)
      await ensureMetadata(unlockedRecord.value)
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
      await ensureMetadata(pendingRecord.value ?? unlockedRecord.value)
      touch()
    } finally {
      busy.value = false
    }
  }

  async function importEnvelope(value: unknown, password: string): Promise<void> {
    busy.value = true
    try {
      const parsed = parseWalletEnvelope(value)
      const record = await decryptWalletEnvelopeOffThread(parsed, password)
      await repository.value.saveEnvelope(parsed)
      pendingEnvelope.value = undefined
      pendingRecord.value = undefined
      envelope.value = parsed
      unlockedRecord.value = record
      lifecycle.value = 'unlocked'
      await ensureMetadata(record)
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
    await ensureMetadata(record)
    touch()
    return structuredClone(nextEnvelope)
  }

  async function recoverFromKit(value: unknown, password: string): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      const kit = parseWalletRecoveryKit(value)
      if (envelope.value && kit.wallet.account_id !== envelope.value.public.account_id)
        throw new Error('恢复材料不属于当前钱包。若要使用其他账户，请先清除本地钱包。')
      const nextEnvelope = await encryptWalletRecord(kit.wallet, password)
      await repository.value.saveEnvelope(nextEnvelope)
      pendingEnvelope.value = undefined
      pendingRecord.value = undefined
      envelope.value = nextEnvelope
      unlockedRecord.value = kit.wallet
      lifecycle.value = 'unlocked'
      await ensureMetadata(kit.wallet)
      touch()
    } finally {
      busy.value = false
    }
  }

  function exportRecoveryKit(): WalletRecoveryKit {
    const record = pendingRecord.value ?? unlockedRecord.value
    if (!record) throw new Error('wallet must be unlocked before exporting recovery material')
    return buildWalletRecoveryKit(record)
  }

  async function clearLocalWallet(): Promise<void> {
    busy.value = true
    error.value = ''
    try {
      const previousAccountID = accountId.value
      clearTimer()
      await repository.value.clear()
      if (previousAccountID) {
        clearTransferJournal(previousAccountID)
        clearTransferReservations(previousAccountID)
      }
      envelope.value = undefined
      unlockedRecord.value = undefined
      pendingEnvelope.value = undefined
      pendingRecord.value = undefined
      lifecycle.value = 'absent'
      metadata.value = undefined
    } finally {
      busy.value = false
    }
  }

  function exportEnvelope(): WalletKeystoreEnvelope {
    if (!envelope.value) throw new Error('wallet is not configured')
    return structuredClone(envelope.value)
  }

  async function saveProfile(displayName: string, avatarDataUrl?: string): Promise<void> {
    if (!unlockedRecord.value) throw new Error('wallet must be unlocked')
    const name = displayName.trim()
    if (!name || name.length > 24) throw new Error('用户名需要 1–24 个字符')
    const current = withAddressDefaults(metadata.value, unlockedRecord.value)
    await persistMetadata({
      ...current,
      profile: avatarDataUrl ? { displayName: name, avatarDataUrl } : { displayName: name },
    })
  }

  async function setAddressMetadata(
    address: string,
    patch: Partial<WalletPublicMetadata['addresses'][string]>,
  ): Promise<void> {
    if (!unlockedRecord.value) throw new Error('wallet must be unlocked')
    const current = withAddressDefaults(metadata.value, unlockedRecord.value)
    const existing = current.addresses[address]
    if (!existing) throw new Error('wallet address is unknown')
    await persistMetadata({
      ...current,
      addresses: { ...current.addresses, [address]: { ...existing, ...patch } },
    })
  }

  async function addAddress(
    type: number,
    password: string,
  ): Promise<WalletRecord['addresses'][number]> {
    if (!envelope.value || !unlockedRecord.value) throw new Error('wallet must be unlocked')
    if (![0, 1, 2].includes(type)) throw new Error('unsupported address type')
    await decryptWalletEnvelope(envelope.value, password)
    const rootSeedHex = generateRootSeedHex()
    const derived = deriveAddressFromRootSeed(rootSeedHex, type)
    const nextAddress = {
      address: derived.address,
      type: String(type),
      root_seed: bytesToBase64(hexToBytes(rootSeedHex)),
    }
    const nextRecord: WalletRecord = {
      ...unlockedRecord.value,
      addresses: [...unlockedRecord.value.addresses, nextAddress],
    }
    const nextEnvelope = await encryptWalletRecord(nextRecord, password)
    await repository.value.saveEnvelope(nextEnvelope)
    envelope.value = nextEnvelope
    unlockedRecord.value = nextRecord
    const current = withAddressDefaults(metadata.value, nextRecord)
    current.addresses[nextAddress.address] = {
      label: `地址 ${nextRecord.addresses.length}`,
      archived: false,
      registration: 'pending',
    }
    await persistMetadata(current)
    return structuredClone(nextAddress)
  }

  function setRepositoryForTests(next: WalletRepository): void {
    clearTimer()
    repository.value = markRaw(next)
    envelope.value = undefined
    unlockedRecord.value = undefined
    pendingEnvelope.value = undefined
    pendingRecord.value = undefined
    metadata.value = undefined
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
    activeAddresses,
    activeRecord,
    metadata,
    profile,
    unlockedRecord,
    initialize,
    unlock,
    create,
    confirmCreatedWallet,
    importEnvelope,
    importLegacy,
    recoverFromKit,
    exportRecoveryKit,
    clearLocalWallet,
    exportEnvelope,
    lock,
    touch,
    clearError,
    saveProfile,
    setAddressMetadata,
    addAddress,
    setRepositoryForTests,
  }
})
