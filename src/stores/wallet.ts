import { computed, markRaw, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { bytesToBase64, bytesToHex, hexToBytes } from '@/protocol-v2/canonical'
import { clearTransferChainScope } from '@/transfer/chainScope'
import { clearTransferJournal } from '@/transfer/journal'
import { clearTransferReservations } from '@/transfer/reservations'
import {
  makeWalletRecord,
  parseWalletEnvelope,
  reencryptWalletRecord,
  sealWalletRecord,
} from '@/wallet/keystore'
import {
  accountIdFromPrivateScalar,
  deriveAddressFromRootSeed,
  generateRootSeedHex,
} from '@/wallet/identity'
import { IndexedDBWalletRepository, type WalletRepository } from '@/wallet/repository'
import { clearOverviewLayout } from '@/wallet/overviewLayout'
import { clearWelcomeGuide, queueWelcomeGuide } from '@/wallet/welcomeGuide'
import { buildWalletRecoveryKit, parseWalletRecoveryKit } from '@/wallet/recovery'
import { createWalletOffThread, decryptWalletEnvelopeOffThread } from '@/wallet/unlockWorker'
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
  let sessionKey: CryptoKey | undefined
  let pendingKey: CryptoKey | undefined
  let sessionVersion = 0
  let addressWrite: Promise<WalletRecord['addresses'][number]> | undefined

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
    sessionVersion += 1
    sessionKey = undefined
    pendingKey = undefined
    unlockedRecord.value = undefined
    pendingEnvelope.value = undefined
    pendingRecord.value = undefined
    lifecycle.value = envelope.value ? 'locked' : 'absent'
  }

  function runInSession(version: number): void {
    if (version !== sessionVersion) throw new Error('wallet must be unlocked')
  }

  async function activateSession(record: WalletRecord, key: CryptoKey, version: number) {
    await ensureMetadata(record)
    runInSession(version)
    unlockedRecord.value = record
    sessionKey = key
    lifecycle.value = 'unlocked'
    touch()
  }

  async function saveUnlockedWallet(
    nextEnvelope: WalletKeystoreEnvelope,
    record: WalletRecord,
    key: CryptoKey,
    version: number,
  ): Promise<void> {
    runInSession(version)
    await repository.value.saveEnvelope(nextEnvelope)
    envelope.value = nextEnvelope
    runInSession(version)
    pendingEnvelope.value = undefined
    pendingRecord.value = undefined
    pendingKey = undefined
    await activateSession(record, key, version)
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
    const version = sessionVersion
    busy.value = true
    error.value = ''
    try {
      if (addressWrite) await addressWrite.catch(() => undefined)
      runInSession(version)
      const saved = await repository.value.loadEnvelope()
      if (!saved) throw new Error('wallet is not configured')
      const { record, key } = await decryptWalletEnvelopeOffThread(saved, password)
      runInSession(version)
      envelope.value = saved
      await loadMetadata(saved.public.account_id)
      await activateSession(record, key, version)
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'wallet unlock failed'
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function create(password: string): Promise<WalletKeystoreEnvelope> {
    const version = sessionVersion
    busy.value = true
    error.value = ''
    try {
      const { record, envelope: nextEnvelope, key } = await createWalletOffThread(password)
      runInSession(version)
      pendingEnvelope.value = nextEnvelope
      pendingRecord.value = record
      pendingKey = key
      return structuredClone(nextEnvelope)
    } finally {
      busy.value = false
    }
  }

  async function confirmCreatedWallet(): Promise<void> {
    if (!pendingEnvelope.value || !pendingRecord.value || !pendingKey)
      throw new Error('wallet creation is not awaiting backup confirmation')
    busy.value = true
    try {
      await saveUnlockedWallet(pendingEnvelope.value, pendingRecord.value, pendingKey, sessionVersion)
      queueWelcomeGuide(accountId.value)
    } finally {
      busy.value = false
    }
  }

  async function importEnvelope(value: unknown, password: string): Promise<void> {
    const version = sessionVersion
    busy.value = true
    try {
      const parsed = parseWalletEnvelope(value)
      const { record, key } = await decryptWalletEnvelopeOffThread(parsed, password)
      await saveUnlockedWallet(parsed, record, key, version)
      clearWelcomeGuide(record.account_id)
    } finally {
      busy.value = false
    }
  }

  async function importLegacy(
    privateScalarHex: string,
    roots: Array<{ type: number; rootSeedHex: string }>,
    password: string,
  ): Promise<WalletKeystoreEnvelope> {
    const version = sessionVersion
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
    const { envelope: nextEnvelope, key } = await sealWalletRecord(record, password)
    await saveUnlockedWallet(nextEnvelope, record, key, version)
    clearWelcomeGuide(record.account_id)
    return structuredClone(nextEnvelope)
  }

  async function recoverFromKit(value: unknown, password: string): Promise<void> {
    const version = sessionVersion
    busy.value = true
    error.value = ''
    try {
      const kit = parseWalletRecoveryKit(value)
      if (envelope.value && kit.wallet.account_id !== envelope.value.public.account_id)
        throw new Error('恢复材料不属于当前钱包。若要使用其他账户，请先清除本地钱包。')
      const { envelope: nextEnvelope, key } = await sealWalletRecord(kit.wallet, password)
      await saveUnlockedWallet(nextEnvelope, kit.wallet, key, version)
      clearWelcomeGuide(kit.wallet.account_id)
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
      lock()
      if (addressWrite) await addressWrite.catch(() => undefined)
      await repository.value.clear()
      if (previousAccountID) {
        clearTransferChainScope(previousAccountID)
        clearTransferJournal(previousAccountID)
        clearTransferReservations(previousAccountID)
        clearOverviewLayout(previousAccountID)
        clearWelcomeGuide(previousAccountID)
        localStorage.removeItem(`pangupay:wallet-entry:no-group:${previousAccountID}`)
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

  async function saveNewAddress(
    type: number,
    record: WalletRecord,
    currentEnvelope: WalletKeystoreEnvelope,
    key: CryptoKey,
    version: number,
  ): Promise<WalletRecord['addresses'][number]> {
    const rootSeedHex = generateRootSeedHex()
    const derived = deriveAddressFromRootSeed(rootSeedHex, type)
    const nextAddress = {
      address: derived.address,
      type: String(type),
      root_seed: bytesToBase64(hexToBytes(rootSeedHex)),
    }
    const nextRecord: WalletRecord = {
      ...record,
      addresses: [...record.addresses, nextAddress],
    }
    const nextEnvelope = await reencryptWalletRecord(nextRecord, key, currentEnvelope.crypto.kdf)
    runInSession(version)
    const current = withAddressDefaults(metadata.value, nextRecord)
    current.addresses[nextAddress.address] = {
      label: `地址 ${nextRecord.addresses.length}`,
      archived: false,
      registration: 'pending',
    }
    await repository.value.saveAddressUpdate(nextEnvelope, current, currentEnvelope.ciphertext)
    if (envelope.value === currentEnvelope) {
      envelope.value = nextEnvelope
      metadata.value = current
    }
    runInSession(version)
    if (sessionKey !== key) throw new Error('wallet must be unlocked')
    unlockedRecord.value = nextRecord
    return structuredClone(nextAddress)
  }

  async function addAddress(type: number): Promise<WalletRecord['addresses'][number]> {
    if (lifecycle.value !== 'unlocked' || !envelope.value || !unlockedRecord.value || !sessionKey)
      throw new Error('wallet must be unlocked')
    if (![0, 1, 2].includes(type)) throw new Error('unsupported address type')
    if (addressWrite || busy.value) throw new Error('wallet is busy')
    addressWrite = saveNewAddress(type, unlockedRecord.value, envelope.value, sessionKey, sessionVersion)
    try {
      return await addressWrite
    } finally {
      addressWrite = undefined
    }
  }

  function setRepositoryForTests(next: WalletRepository): void {
    lock()
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
