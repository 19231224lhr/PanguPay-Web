import { describe, expect, it } from 'vitest'

import { evaluateOrganizationExit } from '@/wallet/organizationExit'

describe('organization exit safety', () => {
  it('blocks exit while fast funds, audits, reservations or transfers remain active', () => {
    const result = evaluateOrganizationExit({
      txCerSpendable: '2.5',
      pendingAudits: 1,
      reservationCount: 1,
      transferPhases: ['settled', 'accepted'],
    })

    expect(result.allowed).toBe(false)
    expect(result.reasons).toEqual([
      '仍有 2.5 PGC 的 TXCer 可支付余额',
      '仍有 1 项责任审计处理中',
      '仍有 1 组交易输入被占用',
      '仍有 1 笔交易正在处理中',
    ])
  })

  it('allows exit when only settled or failed transfers remain', () => {
    expect(
      evaluateOrganizationExit({
        txCerSpendable: '0',
        pendingAudits: 0,
        reservationCount: 0,
        transferPhases: ['settled', 'failed'],
      }),
    ).toEqual({ allowed: true, reasons: [] })
  })
})
