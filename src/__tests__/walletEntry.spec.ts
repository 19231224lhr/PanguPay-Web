import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  formatWalletEntryError,
  hasLocalNoGroupChoice,
  isWalletEntryConnectionError,
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
import WalletEntryView from '@/views/wallet/WalletEntryView.vue'

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
  afterEach(() => {
    configureWalletEntryService(undefined)
    vi.useRealTimers()
  })

  it('classifies browser network failures without calling a remote backend local', () => {
    expect(isWalletEntryConnectionError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isWalletEntryConnectionError(new Error('加入担保组织失败。'))).toBe(false)
    expect(formatWalletEntryError(new TypeError('Failed to fetch'))).toBe(
      '服务连接暂时中断，请稍后重试。',
    )
    expect(formatWalletEntryError(new Error('加入担保组织失败。'))).toBe('加入担保组织失败。')
  })

  it('presents a temporary service interruption as a compact recoverable state', async () => {
    setActivePinia(createPinia())
    configureWalletEntryService(
      entryService(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const wrapper = mount(WalletEntryView, {
      global: {
        stubs: {
          WalletAccessFrame: { template: '<main><slot /></main>' },
          OrganizationDetailDialog: true,
        },
      },
    })
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('服务暂时未就绪')
    expect(wrapper.get('[data-service-interruption]').text()).toContain('钱包仍安全保存在本机')
    expect(wrapper.text()).not.toContain('无法进入钱包')
    expect(wrapper.get('button').text()).toContain('重新连接')

    wrapper.unmount()
  })

  it('retries a temporary service interruption once without another click', async () => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    const recover = vi
      .fn<WalletEntryService['recover']>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ reOnline: { isInGroup: false }, addressGroupIds: [] })
    configureWalletEntryService(entryService(recover))

    const wrapper = mount(WalletEntryView, {
      global: {
        stubs: {
          WalletAccessFrame: { template: '<main><slot /></main>' },
          OrganizationDetailDialog: true,
        },
      },
    })
    await flushPromises()
    expect(recover).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_500)
    await flushPromises()

    expect(recover).toHaveBeenCalledTimes(2)
    expect(wrapper.get('h1').text()).toBe('选择你的使用方式')

    wrapper.unmount()
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
