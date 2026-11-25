import { computed, onMounted } from 'vue'
import { wl, wt } from '@/i18n/walletText'
import { useDashboardStore } from '@/stores/dashboard'
import { useTransferStore } from '@/stores/transfer'
import {
  transferActivityStatus,
  transferModeLabel,
  type TransferMode,
  type TransferPhase,
  type TransferProgress,
} from '@/transfer'
import type { WalletActivity } from '@/wallet/types'

export interface ActivityRow extends WalletActivity {
  txID: string
  statusLabel?: string
  progress?: TransferProgress
  mode?: TransferMode
  phase?: TransferPhase
  lightTxHash?: string
  targetBlock?: number
  crossChainError?: string
}

export const activityAssetSymbol = (coinType?: number, explicit?: string) =>
  (explicit === 'PGC' ? 'CAL' : explicit) ||
  ['CAL', 'BTC', 'ETH'][coinType ?? 0] ||
  wt('assetType', [coinType ?? 0])

/** Keep the overview and full ledger on the same account-scoped activity feed. */
export function useWalletActivities() {
  const dashboard = useDashboardStore()
  const transfer = useTransferStore()
  onMounted(() => void transfer.synchronizeHistory(true))

  return computed<ActivityRow[]>(() => {
    const merged = new Map<string, ActivityRow>()
    for (const item of dashboard.current.activities) {
      const status = item.status.toLowerCase()
      const phase = status === 'settled' || status === 'spend-ready' ? status : undefined
      merged.set(item.id, {
        ...item,
        txID: item.id,
        phase,
        title: item.title === '转入' ? wt('w8') : item.title === '账户更新' ? wt('w496') : item.title,
        statusLabel:
          phase === 'settled'
            ? wt('activitySettled')
            : phase === 'spend-ready'
              ? wt('activitySpendReady')
              : wl(item.status),
      })
    }
    for (const item of transfer.history) {
      merged.set(item.txID, {
        id: item.txID,
        title: transferModeLabel(item.mode),
        amount: item.amount,
        coinType: item.coinType,
        asset: activityAssetSymbol(item.coinType),
        status: transferActivityStatus(item.mode, item.phase, item.crossChainError),
        timestamp: item.backendAcceptedAt ?? item.acceptedAt ?? item.updatedAt,
        progress: item,
        txID: item.txID,
        direction: 'out',
        mode: item.mode,
        phase: item.phase,
        lightTxHash: item.lightTxHash,
        targetBlock: item.targetBlock,
        crossChainError: item.crossChainError,
      })
    }
    return [...merged.values()].sort((left, right) => right.timestamp - left.timestamp)
  })
}
