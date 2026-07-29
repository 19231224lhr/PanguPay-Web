import { parseWalletEnvelope } from '@/wallet/keystore'
import type {
  WalletDashboardSnapshot,
  WalletKeystoreEnvelope,
  WalletPublicMetadata,
} from '@/wallet/types'

export interface WalletRepository {
  loadEnvelope(): Promise<WalletKeystoreEnvelope | undefined>
  saveEnvelope(envelope: unknown): Promise<void>
  loadDashboard(): Promise<WalletDashboardSnapshot | undefined>
  saveDashboard(snapshot: WalletDashboardSnapshot): Promise<void>
  loadMetadata(accountId: string): Promise<WalletPublicMetadata | undefined>
  saveMetadata(metadata: WalletPublicMetadata): Promise<void>
  clear(): Promise<void>
}

const DATABASE_NAME = 'pangupay-wallet'
const DATABASE_VERSION = 1
const ENVELOPE_STORE = 'keystore'
const PUBLIC_STORE = 'public'
const PRIMARY_KEY = 'primary'

function metadataKey(accountId: string): string {
  return `metadata:${accountId}`
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onerror = () => reject(request.error ?? new Error('cannot open wallet database'))
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(ENVELOPE_STORE))
        database.createObjectStore(ENVELOPE_STORE)
      if (!database.objectStoreNames.contains(PUBLIC_STORE))
        database.createObjectStore(PUBLIC_STORE)
    }
    request.onsuccess = () => resolve(request.result)
  })
}

async function requestValue<T>(
  storeName: string,
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    request.onerror = () => reject(request.error ?? new Error('wallet database request failed'))
    request.onsuccess = () => resolve(request.result)
    transaction.oncomplete = () => database.close()
    transaction.onerror = () => {
      database.close()
      reject(transaction.error ?? new Error('wallet database transaction failed'))
    }
  })
}

export class IndexedDBWalletRepository implements WalletRepository {
  async loadEnvelope(): Promise<WalletKeystoreEnvelope | undefined> {
    const value = await requestValue<unknown>(ENVELOPE_STORE, 'readonly', (store) =>
      store.get(PRIMARY_KEY),
    )
    return value == null ? undefined : parseWalletEnvelope(value)
  }

  async saveEnvelope(value: unknown): Promise<void> {
    const envelope = parseWalletEnvelope(value)
    await requestValue<IDBValidKey>(ENVELOPE_STORE, 'readwrite', (store) =>
      store.put(envelope, PRIMARY_KEY),
    )
  }

  async loadDashboard(): Promise<WalletDashboardSnapshot | undefined> {
    return requestValue<WalletDashboardSnapshot | undefined>(PUBLIC_STORE, 'readonly', (store) =>
      store.get(PRIMARY_KEY),
    )
  }

  async saveDashboard(snapshot: WalletDashboardSnapshot): Promise<void> {
    await requestValue<IDBValidKey>(PUBLIC_STORE, 'readwrite', (store) =>
      store.put(structuredClone(snapshot), PRIMARY_KEY),
    )
  }

  async loadMetadata(accountId: string): Promise<WalletPublicMetadata | undefined> {
    if (!accountId.trim()) return undefined
    return requestValue<WalletPublicMetadata | undefined>(PUBLIC_STORE, 'readonly', (store) =>
      store.get(metadataKey(accountId)),
    )
  }

  async saveMetadata(metadata: WalletPublicMetadata): Promise<void> {
    if (!metadata.accountId.trim()) throw new Error('wallet metadata requires an account ID')
    await requestValue<IDBValidKey>(PUBLIC_STORE, 'readwrite', (store) =>
      store.put(structuredClone(metadata), metadataKey(metadata.accountId)),
    )
  }

  async clear(): Promise<void> {
    await Promise.all([
      requestValue<undefined>(ENVELOPE_STORE, 'readwrite', (store) => store.delete(PRIMARY_KEY)),
      requestValue<undefined>(PUBLIC_STORE, 'readwrite', (store) => store.clear()),
    ])
  }
}

export class MemoryWalletRepository implements WalletRepository {
  private envelope?: WalletKeystoreEnvelope
  private dashboard?: WalletDashboardSnapshot
  private metadata?: WalletPublicMetadata

  async loadEnvelope(): Promise<WalletKeystoreEnvelope | undefined> {
    return this.envelope && structuredClone(this.envelope)
  }

  async saveEnvelope(value: unknown): Promise<void> {
    this.envelope = parseWalletEnvelope(value)
  }

  async loadDashboard(): Promise<WalletDashboardSnapshot | undefined> {
    return this.dashboard && structuredClone(this.dashboard)
  }

  async saveDashboard(snapshot: WalletDashboardSnapshot): Promise<void> {
    this.dashboard = structuredClone(snapshot)
  }

  async loadMetadata(accountId: string): Promise<WalletPublicMetadata | undefined> {
    if (this.metadata?.accountId !== accountId) return undefined
    return structuredClone(this.metadata)
  }

  async saveMetadata(metadata: WalletPublicMetadata): Promise<void> {
    if (!metadata.accountId.trim()) throw new Error('wallet metadata requires an account ID')
    this.metadata = structuredClone(metadata)
  }

  async clear(): Promise<void> {
    this.envelope = undefined
    this.dashboard = undefined
    this.metadata = undefined
  }
}
