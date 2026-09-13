import { wt } from '@/i18n/walletText'
import type { TransferMode } from './core'
import type { TransferPhase } from './journal'

export function transferModeLabel(mode: TransferMode): string {
  if (mode === 'quick') return wt('w48')
  if (mode === 'cross') return wt('w326')
  return wt('w421')
}

export function transferResultTitle(mode: TransferMode, phase?: TransferPhase): string {
  if (mode === 'cross') return phase === 'settled' ? wt('w422') : wt('w423')
  if (mode === 'quick' && phase === 'registered') return wt('w424')
  if (mode === 'quick' && phase === 'spend-ready') return wt('w425')
  const label = transferModeLabel(mode)
  return phase === 'settled' ? wt('w426', [label]) : wt('w427', [label])
}

export function transferActivityStatus(
  mode: TransferMode,
  phase: TransferPhase,
  crossChainError?: string,
): string {
  if (phase === 'failed') return wt('w314')
  if (mode === 'cross') {
    if (crossChainError) return wt('w428')
    if (phase === 'settled') return wt('w429')
    if (phase === 'target-accepted') return wt('w430')
    if (phase === 'local-certified') return wt('w431')
    return phase === 'accepted' ? wt('w432') : wt('w433')
  }
  if (mode === 'quick') {
    if (phase === 'settled') return wt('w434')
    if (phase === 'registered') return wt('w435')
    if (phase === 'spend-ready') return wt('w436')
  } else if (phase === 'settled') {
    return wt('w437')
  }
  if (phase === 'review') return wt('w438')
  if (phase === 'submitting') return wt('w439')
  if (phase === 'accepted') return wt('w440')
  return wt('w313')
}
