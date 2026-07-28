import { describe, expect, it } from 'vitest'

import {
  hasLocalNoGroupChoice,
  rememberLocalNoGroupChoice,
  resolveOrganizationEntry,
} from '@/wallet/entry'
import { configureWalletEntryService, getWalletEntryService } from '@/wallet/entryService'
import router from '@/router'

describe('organization entry', () => {
  it('keeps organization recovery outside the authenticated wallet shell', () => {
    const route = router.getRoutes().find((item) => item.name === 'wallet-entry')
    expect(route?.path).toBe('/wallet/entry')
    expect(route?.meta.requiresWallet).toBe(true)
  })

  it('exposes only the configured integration boundary', () => {
    expect(getWalletEntryService()).toBeUndefined()
    const service = {
      recover: async () => ({ reOnline: { isInGroup: false }, addressGroupIds: [] }),
      listOrganizations: async () => [],
      join: async () => undefined,
      registerNoGroup: async () => undefined,
    }
    configureWalletEntryService(service)
    expect(getWalletEntryService()).toBe(service)
  })

  it('trusts a successful re-online result over address cache', () => {
    expect(
      resolveOrganizationEntry({
        reOnline: { isInGroup: true, groupId: 'group-a' },
        addressGroupIds: ['1'],
      }),
    ).toEqual({ kind: 'member', groupId: 'group-a' })
  })

  it('fails closed when re-online denies membership but an address belongs to a group', () => {
    expect(
      resolveOrganizationEntry({
        reOnline: { isInGroup: false },
        addressGroupIds: ['group-a'],
      }),
    ).toEqual({ kind: 'inconsistent', groupIds: ['group-a'] })
  })

  it('recognizes an authoritative no-group address', () => {
    expect(
      resolveOrganizationEntry({
        reOnline: { isInGroup: false },
        addressGroupIds: ['1'],
      }),
    ).toEqual({ kind: 'no-group' })
  })

  it('keeps an unknown prior no-group choice in repair mode', () => {
    expect(
      resolveOrganizationEntry({
        reOnline: { isInGroup: false },
        addressGroupIds: [],
        localSkipped: true,
      }),
    ).toEqual({ kind: 'repair-no-group' })
  })

  it('shows the chooser only for a completely new wallet', () => {
    expect(
      resolveOrganizationEntry({ reOnline: { isInGroup: false }, addressGroupIds: ['0', ''] }),
    ).toEqual({ kind: 'chooser' })
  })

  it('remembers the no-group choice per wallet without treating it as authority', () => {
    const storage = new Map<string, string>()
    const localStorage = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    }

    expect(hasLocalNoGroupChoice('alice', localStorage)).toBe(false)
    rememberLocalNoGroupChoice('alice', localStorage)
    expect(hasLocalNoGroupChoice('alice', localStorage)).toBe(true)
    expect(hasLocalNoGroupChoice('bob', localStorage)).toBe(false)
  })
})
