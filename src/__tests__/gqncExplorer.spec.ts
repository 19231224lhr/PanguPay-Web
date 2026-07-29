import { describe, expect, it } from 'vitest'

import {
  normalizeGQNCBlock,
  normalizeGQNCStatus,
  recentCertifiedHeights,
} from '@/wallet/gqncExplorer'

describe('GQNC explorer normalization', () => {
  it('keeps only authoritative status fields', () => {
    expect(
      normalizeGQNCStatus({
        protocolVersion: 'gqnc-master-v2',
        enabled: true,
        validatorCount: 4,
        quorum: 3,
        certifiedHeight: 42,
        currentView: 2,
        proposerID: 'validator-3',
        latestQCID: 'qc-42',
        safetyStatus: 'NORMAL',
      }),
    ).toEqual({
      protocolVersion: 'gqnc-master-v2',
      enabled: true,
      validatorCount: 4,
      quorum: 3,
      certifiedHeight: 42,
      currentView: 2,
      proposerId: 'validator-3',
      latestQCId: 'qc-42',
      safetyStatus: 'NORMAL',
      safetyReason: '',
    })
  })

  it('unwraps the Gateway status envelope used by the real committee endpoint', () => {
    expect(
      normalizeGQNCStatus({
        success: true,
        status: {
          protocolVersion: 'gqnc-master-v2',
          enabled: true,
          validatorCount: 4,
          quorum: 3,
          certifiedHeight: 14,
          currentView: 0,
          proposerID: 'validator-2',
          latestQCID: 'qc-14',
          safetyStatus: 'NORMAL',
        },
      }),
    ).toMatchObject({
      validatorCount: 4,
      quorum: 3,
      certifiedHeight: 14,
      currentView: 0,
      proposerId: 'validator-2',
      latestQCId: 'qc-14',
      safetyStatus: 'NORMAL',
    })
  })

  it('extracts a certified block, transactions and QC signers without inventing data', () => {
    const txID = 'ab'.repeat(32)
    expect(
      normalizeGQNCBlock({
        envelope: {
          Proposal: { ProposalID: 'proposal-12', ProposerID: 'validator-1', Timestamp: 99 },
          Block: {
            BlockHead: { BlockHeight: 12, BlockHash: 'block-12', Timestamp: 100, TXNum: 1 },
            BlockBody: { Transactions: [{ Transactions: [{ TXID: txID }] }] },
          },
          QC: { QCID: 'qc-12', Threshold: 3, Signers: ['a', 'b', 'c'] },
        },
      }),
    ).toEqual({
      height: 12,
      hash: 'block-12',
      proposerId: 'validator-1',
      proposalId: 'proposal-12',
      timestamp: 100,
      transactionCount: 1,
      transactionIds: [txID],
      qcId: 'qc-12',
      qcThreshold: 3,
      qcSigners: ['a', 'b', 'c'],
    })
  })

  it('returns the latest certified heights in newest-first order', () => {
    expect(recentCertifiedHeights(5, 3)).toEqual([5, 4, 3])
    expect(recentCertifiedHeights(1, 12)).toEqual([1, 0])
  })
})
