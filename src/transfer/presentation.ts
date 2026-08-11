import type { TransferMode } from './core'
import type { TransferPhase } from './journal'

export function transferModeLabel(mode: TransferMode): string {
  if (mode === 'quick') return '快速转账'
  if (mode === 'cross') return '跨链转账'
  return '普通转账'
}

export function transferResultTitle(mode: TransferMode, phase?: TransferPhase): string {
  if (mode === 'cross') return phase === 'settled' ? '跨链到账完成' : '跨链交易处理中'
  const label = transferModeLabel(mode)
  return phase === 'settled' ? `${label}已完成` : `${label}处理中`
}

export function transferActivityStatus(
  mode: TransferMode,
  phase: TransferPhase,
  crossChainError?: string,
): string {
  if (phase === 'failed') return '失败'
  if (mode === 'cross') {
    if (crossChainError) return '需要人工恢复'
    if (phase === 'settled') return '跨链已到账'
    if (phase === 'target-accepted') return '目标链处理中'
    if (phase === 'local-certified') return '本地已认证'
    return phase === 'accepted' ? '跨链交易已接收' : '跨链处理中'
  }
  if (mode === 'quick') {
    if (phase === 'settled') return '后台已结算'
    if (phase === 'spend-ready') return '收款方可用'
  } else if (phase === 'settled') {
    return '已完成'
  }
  if (phase === 'review') return '待审核'
  if (phase === 'submitting') return '正在提交'
  if (phase === 'accepted') return '入口已接收'
  return '处理中'
}
