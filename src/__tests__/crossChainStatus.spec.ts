import { describe, expect, it } from 'vitest'

import {
  crossChainProgressUpdate,
  parseCrossChainTransferStatus,
} from '@/transfer/crossChainStatus'

const response = (state: string) => ({
  success: true,
  transfer: {
    txID: 'a'.repeat(64),
    verifyHash: 'a'.repeat(64),
    state,
    certifiedHeight: 12,
    qcID: 'b'.repeat(64),
    targetAddress: `0x${'1'.repeat(40)}`,
    amount: '1',
    attempts: 1,
  },
})

describe('cross-chain transfer status', () => {
  it('maps local, accepted, confirmed and recovery states without inventing finality', () => {
    expect(
      crossChainProgressUpdate(parseCrossChainTransferStatus(response('PREPARED')), 100),
    ).toMatchObject({ phase: 'local-certified', certifiedHeight: 12 })
    expect(
      crossChainProgressUpdate(
        parseCrossChainTransferStatus({
          ...response('LIGHT_ACCEPTED'),
          transfer: {
            ...response('LIGHT_ACCEPTED').transfer,
            lightTxHash: `0x${'c'.repeat(64)}`,
            acceptedAt: 120,
          },
        }),
        130,
      ),
    ).toMatchObject({ phase: 'target-accepted', targetAcceptedAt: 120 })
    expect(
      crossChainProgressUpdate(
        parseCrossChainTransferStatus({
          ...response('TARGET_CONFIRMED'),
          transfer: {
            ...response('TARGET_CONFIRMED').transfer,
            lightTxHash: `0x${'c'.repeat(64)}`,
            acceptedAt: 120,
            confirmedAt: 180,
            targetBlock: 88,
          },
        }),
        190,
      ),
    ).toMatchObject({ phase: 'settled', targetBlock: 88, targetConfirmedAt: 180 })
    expect(
      crossChainProgressUpdate(
        parseCrossChainTransferStatus({
          ...response('NEEDS_RECOVERY'),
          transfer: { ...response('NEEDS_RECOVERY').transfer, lastError: 'nonce conflict' },
        }),
        200,
      ),
    ).toMatchObject({ phase: 'local-certified', crossChainError: 'nonce conflict' })
  })

  it('fails closed on malformed or mismatched authority data', () => {
    expect(() =>
      parseCrossChainTransferStatus({
        ...response('TARGET_CONFIRMED'),
        transfer: { ...response('TARGET_CONFIRMED').transfer, qcID: 'short' },
      }),
    ).toThrow(/certification/i)
  })
})
