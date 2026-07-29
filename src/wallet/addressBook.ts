import { parseAmount } from '@/protocol-v2/amount'

export interface AddressArchiveState {
  isLastActive: boolean
  utxoBalance: string
  txCerBalance: string
  hasReservedInputs: boolean
  hasPendingTransfers: boolean
  isOrganizationMember: boolean
}

export interface AddressArchiveDecision {
  allowed: boolean
  reasons: string[]
  requiresNetworkUnbind: boolean
}

export function evaluateAddressArchive(state: AddressArchiveState): AddressArchiveDecision {
  const reasons: string[] = []
  if (state.isLastActive) reasons.push('至少保留一个可用地址')
  if (parseAmount(state.utxoBalance) > 0n) reasons.push('地址仍有 UTXO 余额')
  if (parseAmount(state.txCerBalance) > 0n) reasons.push('地址仍有 TXCer 余额')
  if (state.hasReservedInputs) reasons.push('地址仍有被交易占用的输入')
  if (state.hasPendingTransfers) reasons.push('仍有交易正在处理中')
  return {
    allowed: reasons.length === 0,
    reasons,
    requiresNetworkUnbind: state.isOrganizationMember,
  }
}
