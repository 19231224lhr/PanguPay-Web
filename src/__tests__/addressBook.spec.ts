import { describe, expect, it } from 'vitest'

import { evaluateAddressArchive } from '@/wallet/addressBook'

describe('address archive safety', () => {
  it.each([
    [{ isLastActive: true }, '至少保留一个可用地址'],
    [{ utxoBalance: '0.00000001' }, '地址仍有 UTXO 余额'],
    [{ txCerBalance: '1' }, '地址仍有 TXCer 余额'],
    [{ hasReservedInputs: true }, '地址仍有被交易占用的输入'],
    [{ hasPendingTransfers: true }, '仍有交易正在处理中'],
  ])('blocks unsafe archive state %#', (override, message) => {
    const result = evaluateAddressArchive({
      isLastActive: false,
      utxoBalance: '0',
      txCerBalance: '0',
      hasReservedInputs: false,
      hasPendingTransfers: false,
      isOrganizationMember: false,
      ...override,
    })

    expect(result.allowed).toBe(false)
    expect(result.reasons).toContain(message)
  })

  it('allows an empty address and requires an authoritative unbind for organization members', () => {
    expect(
      evaluateAddressArchive({
        isLastActive: false,
        utxoBalance: '0',
        txCerBalance: '0',
        hasReservedInputs: false,
        hasPendingTransfers: false,
        isOrganizationMember: true,
      }),
    ).toEqual({ allowed: true, reasons: [], requiresNetworkUnbind: true })
  })
})
