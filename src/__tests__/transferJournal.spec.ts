import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loadResumableTransferProgress,
  loadTransferJournal,
  recordTransferProgress,
} from '@/transfer/journal'
import {
  loadTransferChainScope,
  reconcileTransferChainScope,
  resolveTransferChainScope,
} from '@/transfer/chainScope'
import { loadTransferReservations, reserveTransferInputs } from '@/transfer/reservations'

describe('transfer progress journal', () => {
  beforeEach(() => localStorage.clear())

  it('records separate acceptance, spend-ready and settlement milestones', () => {
    recordTransferProgress('account-a', {
      draftID: 'draft-a',
      txID: 'a'.repeat(64),
      mode: 'quick',
      amount: '5',
      recipient: 'recipient',
      phase: 'accepted',
      updatedAt: 10,
    })
    recordTransferProgress('account-a', {
      draftID: 'draft-a',
      phase: 'spend-ready',
      updatedAt: 20,
    })

    const progress = loadTransferJournal('account-a')[0]!
    expect(progress).toMatchObject({
      phase: 'spend-ready',
      acceptedAt: 10,
      spendReadyAt: 20,
    })
    expect(progress.settledAt).toBeUndefined()
  })

  it('rejects regression from an authoritative milestone', () => {
    recordTransferProgress('account-a', {
      draftID: 'draft-a',
      txID: 'a'.repeat(64),
      mode: 'normal',
      amount: '1',
      recipient: 'recipient',
      phase: 'settled',
      updatedAt: 30,
    })

    expect(() =>
      recordTransferProgress('account-a', {
        draftID: 'draft-a',
        phase: 'accepted',
        updatedAt: 31,
      }),
    ).toThrow('transfer phase regression')
  })

  it('does not persist private material or wire payloads', () => {
    recordTransferProgress('account-a', {
      draftID: 'draft-a',
      txID: 'a'.repeat(64),
      mode: 'cross',
      amount: '2',
      recipient: '0x' + '1'.repeat(40),
      phase: 'submitting',
      updatedAt: 40,
    })

    const raw = localStorage.getItem('pangupay-transfer-journal:account-a')!
    expect(raw).not.toContain('private')
    expect(raw).not.toContain('RootSeed')
    expect(raw).not.toContain('TXInputs')
  })

  it('persists only the public context needed to resume authoritative monitoring', () => {
    recordTransferProgress('account-a', {
      draftID: 'draft-a',
      txID: 'a'.repeat(64),
      mode: 'quick',
      amount: '5',
      recipient: 'recipient',
      phase: 'accepted',
      inputIDs: ['utxo-1', 'txcer-1'],
      groupID: 'group-a',
      submissionKind: 'assign',
      coinType: 0,
      updatedAt: 10,
    })

    expect(loadResumableTransferProgress('account-a')).toEqual([
      expect.objectContaining({
        draftID: 'draft-a',
        inputIDs: ['utxo-1', 'txcer-1'],
        groupID: 'group-a',
        submissionKind: 'assign',
        coinType: 0,
      }),
    ])
    expect(localStorage.getItem('pangupay-transfer-journal:account-a')).not.toContain('RootSeed')
  })

  it('does not resume a draft without complete public monitor context', () => {
    recordTransferProgress('account-a', {
      draftID: 'draft-a',
      txID: 'a'.repeat(64),
      mode: 'normal',
      amount: '1',
      recipient: 'recipient',
      phase: 'accepted',
      updatedAt: 10,
    })

    expect(loadResumableTransferProgress('account-a')).toEqual([])
  })

  it('resumes cross-chain delivery after local certification and light acceptance', () => {
    const common = {
      txID: 'c'.repeat(64),
      mode: 'cross' as const,
      amount: '1',
      recipient: `0x${'1'.repeat(40)}`,
      inputIDs: ['utxo-cross'],
      groupID: 'group-a',
      submissionKind: 'assign' as const,
      coinType: 0,
    }
    recordTransferProgress('account-a', {
      ...common,
      draftID: 'cross-local',
      phase: 'local-certified',
      certifiedHeight: 9,
      qcID: 'd'.repeat(64),
      updatedAt: 100,
    })
    recordTransferProgress('account-a', {
      ...common,
      draftID: 'cross-light',
      phase: 'target-accepted',
      lightTxHash: `0x${'e'.repeat(64)}`,
      updatedAt: 200,
    })

    expect(loadResumableTransferProgress('account-a').map((item) => item.phase)).toEqual([
      'target-accepted',
      'local-certified',
    ])
  })

  it('migrates legacy cross-chain settlement to a resumable local certification', () => {
    localStorage.setItem(
      'pangupay-transfer-journal:account-a',
      JSON.stringify([
        {
          draftID: 'legacy-cross',
          txID: 'f'.repeat(64),
          mode: 'cross',
          amount: '1',
          recipient: `0x${'2'.repeat(40)}`,
          inputIDs: ['utxo-legacy'],
          groupID: 'group-a',
          submissionKind: 'assign',
          coinType: 0,
          phase: 'settled',
          settledAt: 300,
          updatedAt: 300,
        },
      ]),
    )

    const [progress] = loadResumableTransferProgress('account-a')
    expect(progress).toMatchObject({ draftID: 'legacy-cross', phase: 'local-certified' })
    expect(progress?.settledAt).toBeUndefined()
  })

  it('derives a stable backend scope from certified block one', async () => {
    const gateway = {
      gqncStatus: vi.fn<() => Promise<unknown>>().mockResolvedValue({
        status: {
          protocolVersion: 'gqnc-master-v2',
          enabled: true,
          certifiedHeight: 7,
        },
      }),
      gqncCertifiedBlock: vi.fn<(height: number) => Promise<unknown>>().mockResolvedValue({
        envelope: {
          Block: {
            BlockHead: { BlockHeight: 1, BlockHash: 'A'.repeat(64) },
            BlockBody: {},
          },
          QC: { QCID: 'B'.repeat(64), Threshold: 3, Signers: ['1', '2', '3'] },
        },
      }),
    }

    await expect(resolveTransferChainScope(gateway)).resolves.toBe(
      `gqnc-master-v2:1:${'a'.repeat(64)}:${'b'.repeat(64)}`,
    )
    expect(gateway.gqncCertifiedBlock).toHaveBeenCalledWith(1)
  })

  it('does not invent a scope before the first certified block exists', async () => {
    const gateway = {
      gqncStatus: vi.fn<() => Promise<unknown>>().mockResolvedValue({
        status: { protocolVersion: 'gqnc-master-v2', enabled: true, certifiedHeight: 0 },
      }),
      gqncCertifiedBlock: vi.fn<(height: number) => Promise<unknown>>(),
    }

    await expect(resolveTransferChainScope(gateway)).resolves.toBeUndefined()
    expect(gateway.gqncCertifiedBlock).not.toHaveBeenCalled()
  })

  it('clears unscoped legacy journal and reservations once a chain is known', () => {
    recordTransferProgress('account-a', {
      draftID: 'legacy-draft',
      txID: 'a'.repeat(64),
      mode: 'quick',
      amount: '5',
      recipient: 'recipient',
      phase: 'settled',
      updatedAt: 10,
    })
    reserveTransferInputs('account-a', 'legacy-reservation', ['utxo-1'])

    expect(reconcileTransferChainScope('account-a', 'chain-a')).toBe(true)
    expect(loadTransferChainScope('account-a')).toBe('chain-a')
    expect(loadTransferJournal('account-a')).toEqual([])
    expect(loadTransferReservations('account-a')).toEqual({})
  })

  it('preserves local transfer state on the same certified chain', () => {
    reconcileTransferChainScope('account-a', 'chain-a')
    recordTransferProgress('account-a', {
      draftID: 'current-draft',
      txID: 'a'.repeat(64),
      mode: 'normal',
      amount: '1',
      recipient: 'recipient',
      phase: 'accepted',
      updatedAt: 20,
    })
    reserveTransferInputs('account-a', 'current-draft', ['utxo-2'])

    expect(reconcileTransferChainScope('account-a', 'chain-a')).toBe(false)
    expect(loadTransferJournal('account-a')).toHaveLength(1)
    expect(loadTransferReservations('account-a')).toEqual({ 'current-draft': ['utxo-2'] })
  })

  it('drops only public transfer state when the certified chain changes', () => {
    reconcileTransferChainScope('account-a', 'chain-a')
    recordTransferProgress('account-a', {
      draftID: 'stale-draft',
      txID: 'a'.repeat(64),
      mode: 'quick',
      amount: '2',
      recipient: 'recipient',
      phase: 'spend-ready',
      updatedAt: 30,
    })
    reserveTransferInputs('account-a', 'stale-draft', ['txcer-1'])

    expect(reconcileTransferChainScope('account-a', 'chain-b')).toBe(true)
    expect(loadTransferChainScope('account-a')).toBe('chain-b')
    expect(loadTransferJournal('account-a')).toEqual([])
    expect(loadTransferReservations('account-a')).toEqual({})
  })
})
