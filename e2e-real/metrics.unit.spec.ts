import { describe, expect, it } from 'vitest'

import { assertSoakThresholds, redactEvidence, summarizeSamples } from './metrics'

describe('real E2E evidence helpers', () => {
  it('computes stable latency summaries and long-run drift', () => {
    const samples = Array.from({ length: 500 }, (_, index) => ({
      accepted: true,
      certified: true,
      frontendObservedMs: 200 + (index % 5),
      gqncMs: 80 + (index % 7),
      txcerMs: 30 + (index % 4),
    }))

    const summary = summarizeSamples(samples)

    expect(summary.count).toBe(500)
    expect(summary.accepted).toBe(500)
    expect(summary.certified).toBe(500)
    expect(summary.txcer.p95).toBeLessThanOrEqual(33)
    expect(summary.lastToFirstMedianRatio).toBeCloseTo(1, 2)
    expect(() => assertSoakThresholds(summary)).not.toThrow()
  })

  it('rejects protocol regressions instead of averaging them away', () => {
    const samples = Array.from({ length: 500 }, (_, index) => ({
      accepted: index !== 499,
      certified: true,
      frontendObservedMs: 250,
      gqncMs: 120,
      txcerMs: index < 400 ? 40 : 140,
    }))

    expect(() => assertSoakThresholds(summarizeSamples(samples))).toThrow(/500\/500/)
  })

  it('removes secrets and payload bodies from persisted evidence', () => {
    const value = redactEvidence({
      password: 'do-not-write-this',
      accountPrivateKey: 'a'.repeat(64),
      rootSeed: 'b'.repeat(64),
      request: { method: 'POST', path: '/api/v1/test', postData: '{"secret":true}' },
      response: { status: 200, body: '{"raw":"transaction"}' },
      txID: 'c'.repeat(64),
    }) as Record<string, unknown>

    expect(value.password).toBe('[REDACTED]')
    expect(value.accountPrivateKey).toBe('[REDACTED]')
    expect(value.rootSeed).toBe('[REDACTED]')
    expect(value.txID).toBe('c'.repeat(64))
    expect(value.request).toEqual({ method: 'POST', path: '/api/v1/test' })
    expect(value.response).toEqual({ status: 200 })
  })
})
