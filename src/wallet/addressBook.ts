import { parseAmount } from '@/protocol-v2/amount'

export interface AddressArchiveState {
  isLastActive: boolean
  utxoBalance: string
  txCerBalance: string
  hasReservedInputs: boolean
  hasPendingTransfers: boolean
  ownershipUnknown?: boolean
  isOrganizationMember: boolean
}

export interface AddressArchiveDecision {
  allowed: boolean
  reasons: string[]
  requiresNetworkUnbind: boolean
}

interface AddressArchiveTransfer {
  draftID: string
  phase: string
  sourceAddress?: string
  inputIDs?: readonly string[]
}

export interface AddressArchiveActivityInput {
  address: string
  transfers: readonly AddressArchiveTransfer[]
  reservations: Readonly<Record<string, readonly string[]>>
  inputOwners: Readonly<Record<string, string>>
}

export interface AddressArchiveActivity {
  hasReservedInputs: boolean
  hasPendingTransfers: boolean
  ownershipUnknown: boolean
}

const terminalTransferPhases = new Set(['settled', 'failed'])

function transferSource(
  transfer: AddressArchiveTransfer,
  reservation: readonly string[] | undefined,
  inputOwners: Readonly<Record<string, string>>,
): string | undefined {
  const explicit = transfer.sourceAddress?.trim().toLowerCase()
  if (explicit) return explicit
  const inputIDs = transfer.inputIDs?.length ? transfer.inputIDs : reservation
  if (!inputIDs?.length) return undefined
  const owners = new Set(
    inputIDs.map((id) => inputOwners[id]?.trim().toLowerCase()).filter(Boolean),
  )
  if (owners.size !== 1 || inputIDs.some((id) => !inputOwners[id]?.trim())) return undefined
  return [...owners][0]
}

export function resolveAddressArchiveActivity(
  input: AddressArchiveActivityInput,
): AddressArchiveActivity {
  const target = input.address.trim().toLowerCase()
  const liveTransfers = input.transfers.filter(
    (transfer) => !terminalTransferPhases.has(transfer.phase),
  )
  const byDraft = new Map(liveTransfers.map((transfer) => [transfer.draftID, transfer]))
  let hasReservedInputs = false
  let hasPendingTransfers = false
  let ownershipUnknown = false

  for (const transfer of liveTransfers) {
    const source = transferSource(transfer, input.reservations[transfer.draftID], input.inputOwners)
    if (!source) ownershipUnknown = true
    else if (source === target) hasPendingTransfers = true
  }
  for (const [draftID, inputIDs] of Object.entries(input.reservations)) {
    const transfer = byDraft.get(draftID)
    if (!transfer) {
      if (!input.transfers.some((item) => item.draftID === draftID)) ownershipUnknown = true
      continue
    }
    const source = transferSource(transfer, inputIDs, input.inputOwners)
    if (!source) ownershipUnknown = true
    else if (source === target) hasReservedInputs = true
  }
  return { hasReservedInputs, hasPendingTransfers, ownershipUnknown }
}

export function evaluateAddressArchive(state: AddressArchiveState): AddressArchiveDecision {
  const reasons: string[] = []
  if (state.isLastActive) reasons.push('至少保留一个可用地址')
  if (parseAmount(state.utxoBalance) > 0n) reasons.push('地址仍有 UTXO 余额')
  if (parseAmount(state.txCerBalance) > 0n) reasons.push('地址仍有 TXCer 余额')
  if (state.hasReservedInputs) reasons.push('地址仍有被交易占用的输入')
  if (state.hasPendingTransfers) reasons.push('仍有交易正在处理中')
  if (state.ownershipUnknown) reasons.push('无法确认该地址的归档安全状态')
  return {
    allowed: reasons.length === 0,
    reasons,
    requiresNetworkUnbind: state.isOrganizationMember,
  }
}
