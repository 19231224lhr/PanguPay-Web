import { wt } from '@/i18n/walletText'
import { parseAmount } from '@/protocol-v2/amount'
import type { TransferPhase } from '@/transfer/journal'

export interface OrganizationExitState {
  txCerSpendable: string
  pendingAudits: number
  reservationCount: number
  transferPhases: TransferPhase[]
}

export function evaluateOrganizationExit(state: OrganizationExitState): {
  allowed: boolean
  reasons: string[]
} {
  const reasons: string[] = []
  if (parseAmount(state.txCerSpendable) > 0n) reasons.push(wt('w497', [state.txCerSpendable]))
  if (state.pendingAudits > 0) reasons.push(wt('w498', [state.pendingAudits]))
  if (state.reservationCount > 0) reasons.push(wt('w499', [state.reservationCount]))
  const pendingTransfers = state.transferPhases.filter(
    (phase) => phase !== 'settled' && phase !== 'failed',
  ).length
  if (pendingTransfers > 0) reasons.push(wt('w500', [pendingTransfers]))
  return { allowed: reasons.length === 0, reasons }
}
