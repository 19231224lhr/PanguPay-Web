import { describe, expect, it } from 'vitest'

import {
  ACCEPTED_TRANSFER_MONITOR_LIMIT_MS,
  parseTXCerSpendReadyStatus,
} from '@/transfer/spendReadyStatus'

describe('TXCer spend-ready authority', () => {
  it('separates recipient registration from background settlement', () => {
    expect(
      parseTXCerSpendReadyStatus({
        tx_id: 'a'.repeat(64),
        state: 'spend-ready',
        issued_count: 2,
        registered_count: 2,
        spend_ready_at_unix_ms: 12_345,
      }),
    ).toEqual({
      txID: 'a'.repeat(64),
      state: 'spend-ready',
      issuedCount: 2,
      registeredCount: 2,
      spendReadyAt: 12_345,
      lastError: '',
    })
  })

  it('keeps accepted transactions resumable beyond the old 90 second cutoff', () => {
    expect(ACCEPTED_TRANSFER_MONITOR_LIMIT_MS).toBeGreaterThan(90_000)
  })
})
