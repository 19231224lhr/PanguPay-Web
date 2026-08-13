import { markRaw, shallowRef } from 'vue'
import { defineStore } from 'pinia'

import { GatewayClient } from '@/services/gatewayClient'
import { buildWalletReOnlineMessage } from '@/services/walletEntryGateway'
import { getWalletEntryService } from '@/wallet/entryService'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import {
  buildTransferTransaction,
  ACCEPTED_TRANSFER_MONITOR_LIMIT_MS,
  classifyAssignTransactionStatus,
  clearTransferReservation,
  crossChainProgressUpdate,
  gqncCertifiedHeight,
  gqncConsensusMillisAtHeight,
  hasObservedGQNCCertification,
  isTransferSubmissionRejectedError,
  loadResumableTransferProgress,
  loadTransferReservations,
  mergeSchedulerDAGReceipts,
  parseAssignBackendTiming,
  parseCrossChainTransferStatus,
  parseSchedulerDAGReceipts,
  parseTXCerSpendReadyStatus,
  reconcileTransferChainScope,
  loadTransferJournal,
  recordTransferProgress,
  reserveTransferInputs,
  reservedTransferInputIDs,
  resolveTransferChainScope,
  resolveRecipientSpendMetadata,
  schedulerDAGFailure,
  selectSpendableInputs,
  submitBuiltTransfer,
  type BuiltTransferTransaction,
  type InputSelection,
  type RecipientSpendMetadata,
  type TransferMode,
  type TransferProgress,
} from '@/transfer'
import { loadWalletSpendableSnapshot } from '@/wallet/spendable'
import { resolveTransferRecipient } from '@/transfer/capsuleRecipient'

export type TransferStage = 'compose' | 'review' | 'result'

export interface TransferFormInput {
  mode: TransferMode
  source: string
  recipient: string
  amount: string
  coinType?: number
}

export interface TransferReview {
  draftID: string
  mode: TransferMode
  source: string
  recipient: string
  recipientInput: string
  capsule?: string
  capsuleOrgID?: string
  amount: string
  coinType: number
  membership: 'retail' | 'member'
  guarantorGroupID: string
  selection: InputSelection
  built: BuiltTransferTransaction
}

function crossRecipient(address: string): RecipientSpendMetadata {
  return {
    address: address.trim(),
    groupID: '',
    publicKey: { CurveName: 'P256', X: 0n, Y: 0n },
    coinType: 0,
    seedAnchor: [],
    seedChainStep: 0,
    defaultSpendAlgorithm: '',
  }
}

function humanize(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : String(cause)
  const known: Array<[RegExp, string]> = [
    [/insufficient spendable balance/i, '当前可用余额不足。'],
    [/quick transfer requires/i, '快速转账需要先加入担保组织。'],
    [/cross-chain transfer requires a guarantor/i, '跨链转账需要先加入担保组织。'],
    [/requires whole PGC/i, '跨链转账仅支持整数 PGC。'],
    [/invalid light-compute address/i, '请输入有效的 0x 轻计算地址。'],
    [/recipient is not registered/i, '收款地址尚未在转账区登记。'],
    [/seed metadata/i, '地址的可验证种子信息不完整，请重新同步后再试。'],
    [/amount|decimal|precision/i, '请输入最多 8 位小数的有效金额。'],
  ]
  return known.find(([pattern]) => pattern.test(message))?.[1] ?? message
}

export const useTransferStore = defineStore('transfer', () => {
  const wallet = useWalletStore()
  const dashboard = useDashboardStore()
  const gateway = shallowRef(markRaw(new GatewayClient()))
  const stage = shallowRef<TransferStage>('compose')
  const busy = shallowRef(false)
  const error = shallowRef('')
  const review = shallowRef<TransferReview>()
  const currentProgress = shallowRef<TransferProgress>()
  const history = shallowRef<TransferProgress[]>([])
  const monitoring = new Set<string>()
  let scopeRequest: Promise<boolean> | undefined
  let scopedAccountID = ''
  let activeChainScope = ''
  let monitorEpoch = 0

  function refreshHistory(): void {
    if (!wallet.accountId) {
      history.value = []
      return
    }
    try {
      history.value = loadTransferJournal(wallet.accountId)
    } catch {
      history.value = []
    }
  }

  async function synchronizeHistory(force = false): Promise<boolean> {
    const accountID = wallet.accountId
    if (!accountID || !wallet.unlockedRecord) {
      history.value = []
      return false
    }
    if (!force && scopedAccountID === accountID && activeChainScope) return true
    if (scopeRequest) return scopeRequest

    const request = (async () => {
      try {
        const nextScope = await resolveTransferChainScope(gateway.value)
        if (!nextScope) {
          // A new chain may not have block one yet. Keep offline/local state until
          // there is an immutable anchor that can safely identify the backend.
          refreshHistory()
          return false
        }

        const accountChanged = !!scopedAccountID && scopedAccountID !== accountID
        const discarded = reconcileTransferChainScope(accountID, nextScope)
        if (accountChanged || discarded) {
          monitorEpoch += 1
          review.value = undefined
          currentProgress.value = undefined
          stage.value = 'compose'
        }
        scopedAccountID = accountID
        activeChainScope = nextScope
        refreshHistory()
        return true
      } catch {
        // Network loss must not erase local history. It remains explicitly local
        // until the backend can provide a certified chain anchor again.
        refreshHistory()
        return false
      }
    })()
    scopeRequest = request
    try {
      return await request
    } finally {
      if (scopeRequest === request) scopeRequest = undefined
    }
  }

  function reconcileReservations(): void {
    const journal = new Map(
      loadTransferJournal(wallet.accountId).map((item) => [item.draftID, item]),
    )
    for (const draftID of Object.keys(loadTransferReservations(wallet.accountId))) {
      const progress = journal.get(draftID)
      if (
        !progress ||
        ['review', 'local-certified', 'target-accepted', 'failed', 'settled'].includes(
          progress.phase,
        )
      ) {
        clearTransferReservation(wallet.accountId, draftID)
        continue
      }
    }
  }

  async function prepare(form: TransferFormInput): Promise<void> {
    const record = wallet.activeRecord
    if (!record) throw new Error('钱包尚未解锁。')
    busy.value = true
    error.value = ''
    try {
      if (form.mode === 'cross') {
        const capability = await gateway.value.crossChainCapability()
        if (!capability.enabled || !capability.ready)
          throw new Error('跨链服务当前未就绪，请稍后重试。')
      }
      await synchronizeHistory(true)
      const source = form.source.trim().toLowerCase()
      if (!wallet.activeAddresses.some((address) => address.address.toLowerCase() === source))
        throw new Error('请选择当前钱包中的来源地址。')
      const resolvedRecipient = await resolveTransferRecipient(
        form.recipient,
        form.mode,
        gateway.value,
      )
      if (review.value && stage.value === 'review')
        clearTransferReservation(wallet.accountId, review.value.draftID)
      const snapshot = await loadWalletSpendableSnapshot(gateway.value, {
        userID: wallet.accountId,
        addresses: wallet.activeAddresses.map((address) => address.address),
        reOnlineMessage: buildWalletReOnlineMessage(record),
        receivedTXCers: dashboard.current.receivedTXCers,
      })
      if (snapshot.membership === 'retail') {
        const entry = getWalletEntryService()
        if (!entry) throw new Error('独立地址登记服务尚未就绪。')
        // Registration is also replayed immediately before submission. Doing it
        // here makes the source/change public metadata available to the builder
        // without waiting for a separate address-only block.
        await entry.registerNoGroup()
      }
      reconcileReservations()
      const coinType = form.coinType ?? 0
      const selection = selectSpendableInputs(snapshot, {
        coinType,
        amount: form.amount,
        address: source,
        preferTXCer: form.mode === 'quick',
        reservedIDs: reservedTransferInputIDs(wallet.accountId),
      })
      const addressLookup = await gateway.value.queryAddressGroups([
        ...new Set([source, ...(form.mode === 'cross' ? [] : [resolvedRecipient.address])]),
      ])
      const recipient =
        form.mode === 'cross'
          ? crossRecipient(resolvedRecipient.address)
          : resolveRecipientSpendMetadata(resolvedRecipient.address, addressLookup)
      const change = resolveRecipientSpendMetadata(source, addressLookup)
      const draft = {
        mode: form.mode,
        membership: snapshot.membership,
        coinType,
        amount: form.amount,
        recipient: recipient.address,
        usesTXCer: selection.txCers.length > 0,
      } as const
      const built = buildTransferTransaction({
        wallet: record,
        draft,
        selection,
        recipient,
        change,
        guarantorGroupID: snapshot.guarantorGroupID,
      })
      const draftID = built.txID
      reserveTransferInputs(wallet.accountId, draftID, built.inputIDs)
      review.value = {
        draftID,
        mode: form.mode,
        source,
        recipient: recipient.address,
        recipientInput: form.recipient.trim(),
        capsule: resolvedRecipient.capsule,
        capsuleOrgID: resolvedRecipient.orgID,
        amount: form.amount,
        coinType,
        membership: snapshot.membership,
        guarantorGroupID: snapshot.guarantorGroupID,
        selection,
        built,
      }
      currentProgress.value = recordTransferProgress(wallet.accountId, {
        draftID,
        txID: built.txID,
        mode: form.mode,
        amount: form.amount,
        recipient: recipient.address,
        sourceAddress: source,
        inputIDs: built.inputIDs,
        groupID: snapshot.guarantorGroupID,
        submissionKind: built.submission.kind,
        coinType,
        phase: 'review',
        updatedAt: Date.now(),
      })
      refreshHistory()
      stage.value = 'review'
    } catch (cause) {
      error.value = humanize(cause)
      throw cause
    } finally {
      busy.value = false
    }
  }

  async function monitorAcceptedTransfer(value: TransferProgress): Promise<void> {
    if (
      monitoring.has(value.draftID) ||
      !value.inputIDs?.length ||
      !value.submissionKind ||
      (value.submissionKind === 'assign' && !value.groupID)
    )
      return
    monitoring.add(value.draftID)
    const startedInEpoch = monitorEpoch
    let progress = value
    let lastCertifiedHeight = 0
    const monitorStartedAt = Date.now()
    let nextSettlementCheckAt = 0
    let firstPass = true
    try {
      const monitorLimit = ACCEPTED_TRANSFER_MONITOR_LIMIT_MS
      while (startedInEpoch === monitorEpoch && Date.now() - monitorStartedAt < monitorLimit) {
        if (!firstPass) {
          const elapsed = Date.now() - monitorStartedAt
          const waitingForSpendReady =
            progress.submissionKind === 'assign' && !progress.spendReadyAt
          const delay = !waitingForSpendReady
            ? 2_000
            : elapsed < 1_000
              ? 80
              : elapsed < 5_000
                ? 250
                : 2_000
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
        firstPass = false
        try {
          if (progress.submissionKind === 'assign' && !progress.spendReadyAt) {
            const status = await gateway.value.assignTransactionStatus(
              progress.groupID ?? '',
              progress.txID,
            )
            const state = classifyAssignTransactionStatus(status)
            const backendTiming = parseAssignBackendTiming(status)
            const observedAt = Date.now()
            if (typeof state === 'object') {
              const failed = recordTransferProgress(wallet.accountId, {
                draftID: progress.draftID,
                phase: 'failed',
                error: state.failed,
                updatedAt: observedAt,
              })
              if (currentProgress.value?.draftID === progress.draftID)
                currentProgress.value = failed
              clearTransferReservation(wallet.accountId, progress.draftID)
              refreshHistory()
              return
            }
            if (state === 'accepted' && !progress.acceptedAt) {
              progress = recordTransferProgress(wallet.accountId, {
                draftID: progress.draftID,
                phase: 'accepted',
                backendAcceptedAt: backendTiming.acceptedAt,
                updatedAt: observedAt,
              })
              if (currentProgress.value?.draftID === progress.draftID)
                currentProgress.value = progress
              refreshHistory()
            }
            if (state === 'spend-ready' && progress.mode !== 'quick') {
              progress = recordTransferProgress(wallet.accountId, {
                draftID: progress.draftID,
                phase: 'spend-ready',
                backendAcceptedAt: backendTiming.acceptedAt,
                backendSpendReadyAt: backendTiming.spendReadyAt,
                updatedAt: observedAt,
              })
              if (currentProgress.value?.draftID === progress.draftID)
                currentProgress.value = progress
              refreshHistory()
            }
            if (progress.mode === 'quick') {
              try {
                const readiness = parseTXCerSpendReadyStatus(
                  await gateway.value.txCerSpendReadyStatus(progress.groupID ?? '', progress.txID),
                )
                if (readiness.txID !== progress.txID.toLowerCase())
                  throw new Error('TXCer spend-ready TXID mismatch')
                if (readiness.state === 'failed') {
                  const failed = recordTransferProgress(wallet.accountId, {
                    draftID: progress.draftID,
                    phase: 'failed',
                    error: readiness.lastError || 'TXCer registration failed',
                    updatedAt: observedAt,
                  })
                  if (currentProgress.value?.draftID === progress.draftID)
                    currentProgress.value = failed
                  clearTransferReservation(wallet.accountId, progress.draftID)
                  refreshHistory()
                  return
                }
                if (readiness.state === 'spend-ready') {
                  progress = recordTransferProgress(wallet.accountId, {
                    draftID: progress.draftID,
                    phase: 'spend-ready',
                    backendAcceptedAt: backendTiming.acceptedAt,
                    backendSpendReadyAt: readiness.spendReadyAt,
                    updatedAt: observedAt,
                  })
                  if (currentProgress.value?.draftID === progress.draftID)
                    currentProgress.value = progress
                  refreshHistory()
                }
              } catch {
                // Registration may not exist on the first polls; keep monitoring Assign and GQNC.
              }
            }
          }

          if (progress.submissionKind === 'assign') {
            const afterSeq = progress.dagReceipts?.length
              ? (progress.dagReceipts[progress.dagReceipts.length - 1]?.seq ?? 0)
              : 0
            const incoming = parseSchedulerDAGReceipts(
              await gateway.value.schedulerDAGEvents(
                progress.groupID ?? '',
                progress.txID,
                afterSeq,
              ),
            )
            if (incoming.length) {
              const dagReceipts = mergeSchedulerDAGReceipts(progress.dagReceipts, incoming)
              progress = recordTransferProgress(wallet.accountId, {
                draftID: progress.draftID,
                phase: progress.phase,
                dagReceipts,
                updatedAt: Date.now(),
              })
              if (currentProgress.value?.draftID === progress.draftID)
                currentProgress.value = progress
              refreshHistory()
              const dagFailure = schedulerDAGFailure(dagReceipts)
              if (dagFailure) {
                const failed = recordTransferProgress(wallet.accountId, {
                  draftID: progress.draftID,
                  phase: 'failed',
                  error: dagFailure,
                  updatedAt: Date.now(),
                })
                if (currentProgress.value?.draftID === progress.draftID)
                  currentProgress.value = failed
                clearTransferReservation(wallet.accountId, progress.draftID)
                refreshHistory()
                return
              }
            }
          }

          if (
            progress.mode === 'cross' &&
            ['local-certified', 'target-accepted'].includes(progress.phase)
          ) {
            const status = parseCrossChainTransferStatus(
              await gateway.value.crossChainTransferStatus(progress.txID),
            )
            if (status.txID !== progress.txID.toLowerCase())
              throw new Error('cross-chain status TXID mismatch')
            const update = crossChainProgressUpdate(status, Date.now())
            if (status.state === 'NEEDS_RECOVERY' && progress.phase === 'target-accepted')
              update.phase = 'target-accepted'
            progress = recordTransferProgress(wallet.accountId, {
              draftID: progress.draftID,
              ...update,
            })
            if (currentProgress.value?.draftID === progress.draftID)
              currentProgress.value = progress
            clearTransferReservation(wallet.accountId, progress.draftID)
            refreshHistory()
            if (status.state === 'TARGET_CONFIRMED') {
              await dashboard.sync()
              return
            }
            if (status.state === 'NEEDS_RECOVERY') return
            continue
          }

          if (Date.now() < nextSettlementCheckAt) continue
          nextSettlementCheckAt = Date.now() + 2_000
          const certifiedHeight = gqncCertifiedHeight(await gateway.value.gqncStatus())
          const fromHeight = lastCertifiedHeight
            ? lastCertifiedHeight + 1
            : Math.max(1, certifiedHeight - 49)
          let certifiedBlockHeight = 0
          for (let height = fromHeight; height <= certifiedHeight; height += 1) {
            if (
              hasObservedGQNCCertification(
                progress.txID,
                await gateway.value.gqncCertifiedBlock(height),
              )
            ) {
              certifiedBlockHeight = height
              break
            }
          }
          lastCertifiedHeight = Math.max(lastCertifiedHeight, certifiedHeight)
          if (certifiedBlockHeight) {
            let backendConsensusMillis: number | undefined
            try {
              backendConsensusMillis = gqncConsensusMillisAtHeight(
                await gateway.value.gqncPerformance(),
                certifiedBlockHeight,
              )
            } catch {
              // Performance data is diagnostic; settlement remains authoritative without it.
            }
            if (progress.mode === 'cross') {
              progress = recordTransferProgress(wallet.accountId, {
                draftID: progress.draftID,
                phase: 'local-certified',
                certifiedHeight: certifiedBlockHeight,
                backendConsensusMillis,
                updatedAt: Date.now(),
              })
              if (currentProgress.value?.draftID === progress.draftID)
                currentProgress.value = progress
              clearTransferReservation(wallet.accountId, progress.draftID)
              refreshHistory()
              nextSettlementCheckAt = 0
              continue
            }
            const settled = recordTransferProgress(wallet.accountId, {
              draftID: progress.draftID,
              phase: 'settled',
              backendConsensusMillis,
              updatedAt: Date.now(),
            })
            if (currentProgress.value?.draftID === progress.draftID) currentProgress.value = settled
            clearTransferReservation(wallet.accountId, progress.draftID)
            refreshHistory()
            await dashboard.sync()
            return
          }
        } catch {
          // A transient status lookup must not turn an accepted transaction into a failure.
        }
      }
    } finally {
      monitoring.delete(value.draftID)
    }
  }

  function resumePendingMonitoring(): void {
    if (!wallet.accountId || !wallet.unlockedRecord) return
    try {
      for (const progress of loadResumableTransferProgress(wallet.accountId))
        void monitorAcceptedTransfer(progress)
    } catch {
      // A damaged public journal is not authority and must not unlock reserved inputs.
    }
  }

  async function submit(): Promise<void> {
    await synchronizeHistory(true)
    const value = review.value
    if (!value || stage.value !== 'review') throw new Error('没有等待审核的交易。')
    busy.value = true
    error.value = ''
    currentProgress.value = recordTransferProgress(wallet.accountId, {
      draftID: value.draftID,
      phase: 'submitting',
      updatedAt: Date.now(),
    })
    refreshHistory()
    try {
      await submitBuiltTransfer(gateway.value, value.built, {
        beforeRetailSubmit:
          value.membership === 'retail'
            ? async () => {
                const entry = getWalletEntryService()
                if (!entry) throw new Error('独立地址登记服务尚未就绪。')
                await entry.registerNoGroup()
              }
            : undefined,
      })
      currentProgress.value = recordTransferProgress(wallet.accountId, {
        draftID: value.draftID,
        phase: 'accepted',
        updatedAt: Date.now(),
      })
      refreshHistory()
      stage.value = 'result'
      void monitorAcceptedTransfer(currentProgress.value)
    } catch (cause) {
      const explicitRejection = isTransferSubmissionRejectedError(cause)
      const message = explicitRejection
        ? humanize(cause)
        : '提交结果暂时未知，正在通过权威账户状态核对。'
      currentProgress.value = recordTransferProgress(wallet.accountId, {
        draftID: value.draftID,
        phase: explicitRejection ? 'failed' : 'submitting',
        error: message,
        updatedAt: Date.now(),
      })
      if (explicitRejection) clearTransferReservation(wallet.accountId, value.draftID)
      else {
        stage.value = 'result'
        void monitorAcceptedTransfer(currentProgress.value)
      }
      refreshHistory()
      error.value = message
      throw cause
    } finally {
      busy.value = false
    }
  }

  function cancelReview(): void {
    if (review.value && stage.value === 'review')
      clearTransferReservation(wallet.accountId, review.value.draftID)
    review.value = undefined
    currentProgress.value = undefined
    error.value = ''
    stage.value = 'compose'
  }

  function startAnother(): void {
    review.value = undefined
    currentProgress.value = undefined
    error.value = ''
    stage.value = 'compose'
  }

  function dismissError(): void {
    error.value = ''
  }

  function setGatewayForTests(next: GatewayClient): void {
    gateway.value = markRaw(next)
    scopedAccountID = ''
    activeChainScope = ''
    scopeRequest = undefined
    monitorEpoch += 1
  }

  void synchronizeHistory(true).then((scoped) => {
    if (scoped) resumePendingMonitoring()
  })

  return {
    stage,
    busy,
    error,
    review,
    currentProgress,
    history,
    synchronizeHistory,
    prepare,
    submit,
    cancelReview,
    startAnother,
    dismissError,
    setGatewayForTests,
  }
})
