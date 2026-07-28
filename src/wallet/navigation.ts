import type { WalletLifecycle } from '@/wallet/types'

export function resolveWalletEntry(lifecycle: WalletLifecycle): string {
  if (lifecycle === 'absent') return '/wallet/setup'
  if (lifecycle === 'locked') return '/wallet/unlock'
  return '/wallet/entry'
}
