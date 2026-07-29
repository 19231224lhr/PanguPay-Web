import { afterEach, describe, expect, it } from 'vitest'

import {
  formatWalletEntryError,
  hasLocalNoGroupChoice,
  rememberLocalNoGroupChoice,
  resolveOrganizationEntry,
} from '@/wallet/entry'
import {
  configureWalletEntryService,
  getWalletEntryService,
  resolveWalletArrival,
  type WalletEntryService,
} from '@/wallet/entryService'
import router from '@/router'

function entryService(recover: WalletEntryService['recover']): WalletEntryService {
  return {
    recover,
    listOrganizations: async () => [],
    organization: async (id: string) => ({
      id,
      name: `担保组织 ${id}`,
      guarantorCount: 0,
      certifierCount: 0,
      nodes: [],
      assignAvailable: false,
      aggregationAvailable: false,
    }),
    join: async () => undefined,
    leave: async () => undefined,
    registerAddress: async () => undefined,
    unbindAddress: async () => undefined,
    registerNoGroup: async () => undefined,
  }
}

describe('organization entry', () => {
  afterEach(() => configureWalletEntryService(undefined))

  it('turns browser network failures into a useful local-service message', () => {
    expect(formatWalletEntryError(new TypeError('Failed to fetch'))).toBe(
      '无法连接到本地服务，请确认后端已启动后重试。',
    )
    expect(formatWalletEntryError(new Error('加入担保组织失败。'))).toBe('加入担保组织失败。')
  })

  it('keeps organization recovery outside the authenticated wallet shell', () => {
    const route = router.getRoutes().find((item) => item.name === 'wallet-entry')
    expect(route?.path).toBe('/wallet/entry')
    expect(route?.meta.requiresWallet).toBe(true)
  })

  it('exposes only the configured integration boundary', () => {
    expect(getWalletEntryService()).toBeUndefined()
    const service = entryService(async () => ({
      reOnline: { isInGroup: false },
      addressGroupIds: [],
    }))
    configureWalletEntryService(service)
    expect(getWalletEntryService()).toBe(service)
  })

  it('sends known members directly to the wallet after unlock', async () => {
    configureWalletEntryService(
      entryService(async () => ({
        reOnline: { isInGroup: true, groupId: 'group-a' },
        addressGroupIds: [],
      })),
    )

    await expect(resolveWalletArrival('alice')).resolves.toBe('/wallet')
  })

  it('keeps the entry page only when the user still needs to choose', async () => {
    configureWalletEntryService(
      entryService(async () => ({
        reOnline: { isInGroup: false },
        addressGroupIds: [],
      })),
    )

    await expect(resolveWalletArrival('new-account')).resolves.toBe('/wallet/entry')
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
