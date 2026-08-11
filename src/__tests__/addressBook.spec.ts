import { describe, expect, it } from 'vitest'

import { evaluateAddressArchive, resolveAddressArchiveActivity } from '@/wallet/addressBook'

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

  it('does not let a pending transfer from one address block another empty address', () => {
    expect(
      resolveAddressArchiveActivity({
        address: 'address-b',
        transfers: [
          {
            draftID: 'draft-a',
            phase: 'accepted',
            sourceAddress: 'address-a',
            inputIDs: ['utxo-a'],
          },
        ],
        reservations: { 'draft-a': ['utxo-a'] },
        inputOwners: { 'utxo-a': 'address-a' },
      }),
    ).toEqual({ hasReservedInputs: false, hasPendingTransfers: false, ownershipUnknown: false })
  })

  it('blocks the address that owns a pending transfer and its reservation', () => {
    expect(
      resolveAddressArchiveActivity({
        address: 'address-b',
        transfers: [
          {
            draftID: 'draft-b',
            phase: 'accepted',
            sourceAddress: 'address-b',
            inputIDs: ['utxo-b'],
          },
        ],
        reservations: { 'draft-b': ['utxo-b'] },
        inputOwners: { 'utxo-b': 'address-b' },
      }),
    ).toEqual({ hasReservedInputs: true, hasPendingTransfers: true, ownershipUnknown: false })
  })

  it('resolves a legacy transfer source from authoritative input ownership', () => {
    expect(
      resolveAddressArchiveActivity({
        address: 'address-b',
        transfers: [{ draftID: 'legacy-a', phase: 'accepted', inputIDs: ['utxo-a'] }],
        reservations: { 'legacy-a': ['utxo-a'] },
        inputOwners: { 'utxo-a': 'address-a' },
      }),
    ).toEqual({ hasReservedInputs: false, hasPendingTransfers: false, ownershipUnknown: false })
  })

  it('fails closed when a legacy transfer input owner cannot be established', () => {
    const activity = resolveAddressArchiveActivity({
      address: 'address-b',
      transfers: [{ draftID: 'legacy', phase: 'accepted', inputIDs: ['missing'] }],
      reservations: { legacy: ['missing'] },
      inputOwners: {},
    })
    expect(activity.ownershipUnknown).toBe(true)
    expect(
      evaluateAddressArchive({
        isLastActive: false,
        utxoBalance: '0',
        txCerBalance: '0',
        ...activity,
        isOrganizationMember: false,
      }).reasons,
    ).toContain('无法确认该地址的归档安全状态')
  })
})
