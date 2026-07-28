import { beforeEach, describe, expect, it } from 'vitest'

import {
  loadResumableTransferProgress,
  loadTransferJournal,
  recordTransferProgress,
} from '@/transfer/journal'

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
})
