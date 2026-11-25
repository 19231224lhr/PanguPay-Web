import { beforeEach, expect, it } from 'vitest'
import { recordTransferProgress, loadResumableTransferProgress } from '@/transfer/journal'
import { buildTransferTimeline } from '@/transfer/workflow'
import { transferResultTitle } from '@/transfer/presentation'

beforeEach(() => localStorage.clear())
it('persists registration, advances organization progress, and resumes settlement monitoring', () => {
  const progress = recordTransferProgress('test', {
    draftID: 'registration',
    txID: 'a'.repeat(64),
    mode: 'quick',
    amount: '1',
    recipient: 'recipient',
    phase: 'registered',
    acceptedAt: 1000,
    backendAcceptedAt: 1000,
    registeredAt: 1060,
    updatedAt: 1080,
    inputIDs: ['utxo-1'],
    submissionKind: 'assign',
    groupID: '10000000',
    coinType: 0,
  })
  expect(loadResumableTransferProgress('test')).toEqual([progress])
  expect(progress.spendReadyAt).toBeUndefined()
  const timeline = buildTransferTimeline(progress)
  expect(timeline.find((s) => s.id === 'organization')).toMatchObject({ state: 'complete' })
  expect(timeline.find((s) => s.id === 'organization')?.meta).toContain('60 ms')
  expect(timeline.find((s) => s.id === 'recipient-ready')).toBeUndefined()
  expect(timeline.find((s) => s.id === 'settlement')?.state).toBe('active')
  expect(transferResultTitle('quick', progress.phase)).toContain('TXCer')
  const settled = recordTransferProgress('test', {
    draftID: 'registration',
    phase: 'settled',
    updatedAt: 91000,
  })
  expect(loadResumableTransferProgress('test')).toEqual([])
  expect(buildTransferTimeline(settled).find((s) => s.id === 'settlement')?.state).toBe('complete')
  expect(settled.spendReadyAt).toBeUndefined()
})
