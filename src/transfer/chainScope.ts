import { normalizeGQNCBlock, normalizeGQNCStatus } from '@/wallet/gqncExplorer'

import { clearTransferJournal } from './journal'
import { clearTransferReservations } from './reservations'

interface TransferChainGateway {
  gqncStatus(): Promise<unknown>
  gqncCertifiedBlock(height: number): Promise<unknown>
}

const SCOPE_PREFIX = 'pangupay-transfer-chain:'

function key(accountID: string): string {
  const normalized = accountID.trim()
  if (!normalized) throw new Error('account ID is required')
  return `${SCOPE_PREFIX}${normalized}`
}

/**
 * Block one is immutable while a backend chain grows, but changes when the
 * server starts again from a fresh database. That makes it a stable local
 * namespace for disposable transfer progress without coupling it to height.
 */
export async function resolveTransferChainScope(
  gateway: TransferChainGateway,
): Promise<string | undefined> {
  const status = normalizeGQNCStatus(await gateway.gqncStatus())
  if (!status.enabled || status.certifiedHeight < 1) return undefined

  const anchor = normalizeGQNCBlock(await gateway.gqncCertifiedBlock(1))
  const hash = anchor.hash.trim().toLowerCase()
  const qcID = anchor.qcId.trim().toLowerCase()
  if (anchor.height !== 1 || !hash || !qcID)
    throw new Error('certified chain anchor is unavailable')

  return `${status.protocolVersion || 'gqnc'}:1:${hash}:${qcID}`
}

export function loadTransferChainScope(accountID: string): string | undefined {
  return localStorage.getItem(key(accountID))?.trim() || undefined
}

export function clearTransferChainScope(accountID: string): void {
  localStorage.removeItem(key(accountID))
}

/** Returns true when stale or legacy public transfer state was discarded. */
export function reconcileTransferChainScope(accountID: string, scope: string): boolean {
  const normalized = scope.trim()
  if (!normalized) throw new Error('transfer chain scope is required')
  if (loadTransferChainScope(accountID) === normalized) return false

  clearTransferJournal(accountID)
  clearTransferReservations(accountID)
  localStorage.setItem(key(accountID), normalized)
  return true
}
