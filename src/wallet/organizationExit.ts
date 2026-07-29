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
  if (parseAmount(state.txCerSpendable) > 0n)
    reasons.push(`仍有 ${state.txCerSpendable} PGC 的 TXCer 可支付余额`)
  if (state.pendingAudits > 0) reasons.push(`仍有 ${state.pendingAudits} 项责任审计处理中`)
  if (state.reservationCount > 0) reasons.push(`仍有 ${state.reservationCount} 组交易输入被占用`)
  const pendingTransfers = state.transferPhases.filter(
    (phase) => phase !== 'settled' && phase !== 'failed',
  ).length
  if (pendingTransfers > 0) reasons.push(`仍有 ${pendingTransfers} 笔交易正在处理中`)
  return { allowed: reasons.length === 0, reasons }
}
