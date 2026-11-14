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

describe('Hong Kong registration contract', () => {
  const response = {
    metric_name: 'assign_ack_ready',
    tx_id: 'a'.repeat(64),
    state: 'ready',
    issued_count: 2,
    registered_count: 2,
    assign_ack_ready_at_unix_ms: 1789277256381,
  }
  it('accepts actual registration response without claiming wallet spend-readiness', () => {
    const parsed = parseTXCerSpendReadyStatus(response)
    expect(parsed.state).toBe('registered')
    expect(parsed.registeredAt).toBe(1789277256381)
    expect(parsed.spendReadyAt).toBeUndefined()
  })
  it.each([
    { registered_count: 1 },
    { issued_count: 0, registered_count: 0 },
    { assign_ack_ready_at_unix_ms: undefined },
    { assign_ack_ready_at_unix_ms: -1 },
    { metric_name: 'unknown' },
  ])('rejects incomplete or unrecognized registration evidence %j', (override) => {
    expect(() => parseTXCerSpendReadyStatus({ ...response, ...override })).toThrow(/.+/)
  })
})
