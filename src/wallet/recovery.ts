import { validateWalletRecord } from '@/wallet/keystore'
import type { WalletRecord, WalletRecoveryKit } from '@/wallet/types'

function exactKeys(value: Record<string, unknown>, keys: string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]))
    throw new Error(`${label} has unsupported fields`)
}

export function buildWalletRecoveryKit(record: WalletRecord): WalletRecoveryKit {
  return {
    version: 1,
    kind: 'pangu-wallet-recovery',
    wallet: validateWalletRecord(record),
  }
}

export function parseWalletRecoveryKit(value: unknown): WalletRecoveryKit {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('recovery kit must be an object')
  const kit = value as Record<string, unknown>
  exactKeys(kit, ['version', 'kind', 'wallet'], 'recovery kit')
  if (kit.version !== 1 || kit.kind !== 'pangu-wallet-recovery')
    throw new Error('unsupported wallet recovery kit')
  if (!kit.wallet || typeof kit.wallet !== 'object' || Array.isArray(kit.wallet))
    throw new Error('recovery kit wallet must be an object')
  return {
    version: 1,
    kind: 'pangu-wallet-recovery',
    wallet: validateWalletRecord(kit.wallet as WalletRecord),
  }
}
