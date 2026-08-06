import { describe, expect, it, vi } from 'vitest'

import type { BuiltTransferTransaction } from '@/transfer/builder'
import { GatewayRequestError } from '@/services/gatewayClient'
import {
  buildTransferTimeline,
  classifyAssignTransactionStatus,
  hasObservedGQNCCertification,
  isTransferSubmissionRejectedError,
  mergeSchedulerDAGReceipts,
  parseAssignBackendTiming,
  parseSchedulerDAGReceipts,
  schedulerDAGFailure,
  submitBuiltTransfer,
} from '@/transfer/workflow'

const built = (kind: 'retail' | 'assign'): BuiltTransferTransaction => ({
  tx: { TXID: 'a'.repeat(64) },
  txID: 'a'.repeat(64),
  inputIDs: ['input-1'],
  submission:
    kind === 'retail'
      ? { kind, body: {} as never }
      : { kind, body: {} as never, groupID: 'group-1' },
})

describe('transfer submission workflow', () => {
  it('routes retail and member transactions to their authoritative endpoints', async () => {
    const gateway = {
      submitNoGroupTransaction: vi
        .fn<(message: unknown) => Promise<unknown>>()
        .mockResolvedValue({ success: true }),
      submitAssignTransaction: vi
        .fn<(groupID: string, message: unknown) => Promise<unknown>>()
        .mockResolvedValue({ success: true, tx_id: 'a'.repeat(64) }),
    }

    await expect(submitBuiltTransfer(gateway, built('retail'))).resolves.toMatchObject({
      accepted: true,
    })
    await expect(submitBuiltTransfer(gateway, built('assign'))).resolves.toMatchObject({
      accepted: true,
    })
    expect(gateway.submitNoGroupTransaction).toHaveBeenCalledTimes(1)
    expect(gateway.submitAssignTransaction).toHaveBeenCalledWith('group-1', {})
  })

  it('replays retail address authorization immediately before submission', async () => {
    const order: string[] = []
    const gateway = {
      submitNoGroupTransaction: vi.fn<() => Promise<{ success: boolean }>>(async () => {
        order.push('submit')
        return { success: true }
      }),
      submitAssignTransaction: vi.fn<() => Promise<{ success: boolean }>>(async () => ({
        success: true,
      })),
    }

    await submitBuiltTransfer(gateway, built('retail'), {
      beforeRetailSubmit: async () => {
        order.push('authorize')
      },
    })

    expect(order).toEqual(['authorize', 'submit'])
  })

  it('fails closed when a 2xx-shaped body explicitly rejects the transaction', async () => {
    const gateway = {
      submitNoGroupTransaction: vi
        .fn<(message: unknown) => Promise<unknown>>()
        .mockResolvedValue({ success: false, error: 'rejected' }),
      submitAssignTransaction: vi.fn<(groupID: string, message: unknown) => Promise<unknown>>(),
    }
    await expect(submitBuiltTransfer(gateway, built('retail'))).rejects.toThrow('rejected')
  })

  it('separates Assign receipt, recipient spend-readiness, and GQNC settlement', () => {
    expect(classifyAssignTransactionStatus({ status: 'queued', receive_result: true })).toBe(
      'accepted',
    )
    expect(classifyAssignTransactionStatus({ status: 'success', result: true })).toBe('spend-ready')
    expect(classifyAssignTransactionStatus({ status: 'completed', result: true })).toBe(
      'spend-ready',
    )
    expect(
      classifyAssignTransactionStatus({
        status: 'processing',
        scheduler_status: 'success',
        receive_result: true,
        result: true,
      }),
    ).toBe('spend-ready')
    expect(
      classifyAssignTransactionStatus({
        status: 'failed',
        scheduler_status: 'failed',
        receive_result: true,
        result: false,
        error_reason: 'seed sweep required',
      }),
    ).toEqual({ failed: 'seed sweep required' })
    expect(
      classifyAssignTransactionStatus({
        status: 'rejected',
        scheduler_status: 'rejected',
        result: false,
        error_reason: 'resource conflict',
      }),
    ).toEqual({ failed: 'resource conflict' })
    expect(
      classifyAssignTransactionStatus({ status: 'failed', result: false, error_reason: '' }),
    ).toEqual({ failed: '后端未接受这笔交易。' })
    expect(classifyAssignTransactionStatus({ status: 'unknown' })).toBe('pending')
  })

  it('keeps authoritative backend timing separate from browser observation timing', () => {
    expect(
      parseAssignBackendTiming({
        accepted_at_unix_ms: 10_000,
        spend_ready_at_unix_ms: 10_024,
      }),
    ).toEqual({ acceptedAt: 10_000, spendReadyAt: 10_024 })
    expect(
      parseAssignBackendTiming({
        accepted_at_unix_ms: 10_024,
        spend_ready_at_unix_ms: 10_000,
      }),
    ).toEqual({})
  })

  it('normalizes, orders, and deduplicates signed scheduler receipts from the backend view', () => {
    const receipts = parseSchedulerDAGReceipts({
      events: [
        {
          EventID: 'verify',
          Seq: 7,
          EventType: 'verify_passed',
          SourceNodeRole: 'guar',
          SourceNodeID: 'guar-1',
          FromStatus: 'processing',
          ToStatus: 'pending_confirm',
          Timestamp: 100,
        },
        {
          EventID: 'submit',
          Seq: 2,
          EventType: 'submitted',
          NodeRole: 'assign',
          NodeID: 'assign-1',
          FromStatus: '',
          ToStatus: 'processing',
        },
        { EventID: 'ignored', Seq: 0, EventType: 'queued', ToStatus: 'queued' },
        {
          EventID: 'verify',
          Seq: 7,
          EventType: 'verify_passed',
          SourceNodeRole: 'guar',
          SourceNodeID: 'guar-1',
          ToStatus: 'pending_confirm',
        },
      ],
    })

    expect(receipts).toEqual([
      expect.objectContaining({ eventID: 'submit', seq: 2, nodeRole: 'assign' }),
      expect.objectContaining({ eventID: 'verify', seq: 7, nodeRole: 'guar' }),
    ])
    expect(mergeSchedulerDAGReceipts(receipts, receipts)).toHaveLength(2)
    expect(schedulerDAGFailure(receipts)).toBeUndefined()
  })

  it('surfaces the authoritative aggregation failure reason from the DAG receipt', () => {
    const receipts = parseSchedulerDAGReceipts({
      events: [
        {
          EventID: 'aggr-failed',
          Seq: 9,
          EventType: 'aggr_failed',
          NodeRole: 'assign',
          SourceNodeRole: 'aggr',
          SourceNodeID: 'aggr-1',
          FromStatus: 'pending_confirm',
          ToStatus: 'failed',
          Reason: 'normal input UTXO not found',
        },
      ],
    })

    expect(schedulerDAGFailure(receipts)).toBe('normal input UTXO not found')
  })

  it('compresses scheduler receipts into five user-facing milestones', () => {
    const timeline = buildTransferTimeline({
      draftID: 'draft-1',
      txID: 'a'.repeat(64),
      mode: 'quick',
      amount: '10',
      recipient: 'b'.repeat(40),
      phase: 'accepted',
      acceptedAt: 1_000,
      updatedAt: 1_250,
      dagReceipts: [
        {
          eventID: '1',
          seq: 21,
          eventType: 'submitted',
          nodeRole: 'assign',
          toStatus: 'processing',
        },
        {
          eventID: '2',
          seq: 22,
          eventType: 'acquired',
          nodeRole: 'assign',
          toStatus: 'processing',
        },
        {
          eventID: '3',
          seq: 23,
          eventType: 'dispatched',
          nodeRole: 'assign',
          toStatus: 'processing',
        },
        {
          eventID: '4',
          seq: 24,
          eventType: 'guar_received',
          nodeRole: 'guar',
          toStatus: 'processing',
        },
        {
          eventID: '5',
          seq: 25,
          eventType: 'verify_started',
          nodeRole: 'guar',
          toStatus: 'processing',
        },
        {
          eventID: '6',
          seq: 26,
          eventType: 'verify_passed',
          nodeRole: 'guar',
          toStatus: 'pending_confirm',
        },
      ],
    })

    expect(timeline).toHaveLength(5)
    expect(timeline.map((item) => item.label)).toEqual([
      '交易已接收',
      '担保验证',
      '组织确认',
      '收款方可用',
      '后台结算',
    ])
    expect(timeline.map((item) => item.state)).toEqual([
      'complete',
      'complete',
      'active',
      'pending',
      'pending',
    ])
  })

  it('shows only the authoritative backend spend-ready time', () => {
    const timeline = buildTransferTimeline({
      draftID: 'draft-timing',
      txID: 'a'.repeat(64),
      mode: 'quick',
      amount: '1',
      recipient: 'b'.repeat(40),
      phase: 'spend-ready',
      acceptedAt: 20_000,
      spendReadyAt: 20_180,
      backendAcceptedAt: 10_000,
      backendSpendReadyAt: 10_024,
      updatedAt: 20_180,
    })

    expect(timeline.find((item) => item.id === 'recipient-ready')?.meta).toBe('可用耗时 24 ms')
  })

  it('observes settlement only from a 3-of-4 certified block containing the TXID', () => {
    const envelope = {
      success: true,
      envelope: {
        QC: {
          QCID: 'b'.repeat(64),
          Threshold: 3,
          Signers: ['one', 'two', 'three'],
        },
        Block: {
          Body: {
            Transactions: [{ AggregateTX: { AllTransactions: [{ TXID: 'a'.repeat(64) }] } }],
          },
        },
      },
    }

    expect(hasObservedGQNCCertification('a'.repeat(64), envelope)).toBe(true)
    expect(hasObservedGQNCCertification('c'.repeat(64), envelope)).toBe(false)
    expect(
      hasObservedGQNCCertification('a'.repeat(64), {
        ...envelope,
        envelope: {
          ...envelope.envelope,
          QC: { ...envelope.envelope.QC, Signers: ['one', 'two'] },
        },
      }),
    ).toBe(false)
  })

  it('distinguishes an explicit backend rejection from an ambiguous transport error', async () => {
    const rejectedGateway = {
      submitNoGroupTransaction: vi
        .fn<(message: unknown) => Promise<unknown>>()
        .mockResolvedValue({ success: false, error: 'rejected' }),
      submitAssignTransaction: vi.fn<(groupID: string, message: unknown) => Promise<unknown>>(),
    }
    const ambiguousGateway = {
      submitNoGroupTransaction: vi
        .fn<(message: unknown) => Promise<unknown>>()
        .mockRejectedValue(new TypeError('network failed')),
      submitAssignTransaction: vi.fn<(groupID: string, message: unknown) => Promise<unknown>>(),
    }

    await expect(submitBuiltTransfer(rejectedGateway, built('retail'))).rejects.toSatisfy(
      isTransferSubmissionRejectedError,
    )
    await expect(submitBuiltTransfer(ambiguousGateway, built('retail'))).rejects.not.toSatisfy(
      isTransferSubmissionRejectedError,
    )
  })

  it('treats an HTTP response from the backend as an explicit rejection', async () => {
    const gateway = {
      submitNoGroupTransaction: vi
        .fn<(message: unknown) => Promise<unknown>>()
        .mockRejectedValue(
          new GatewayRequestError(400, { error: 'SignPublicKeyV2 missing for address' }),
        ),
      submitAssignTransaction: vi.fn<(groupID: string, message: unknown) => Promise<unknown>>(),
    }

    await expect(submitBuiltTransfer(gateway, built('retail'))).rejects.toSatisfy(
      isTransferSubmissionRejectedError,
    )
  })
})
