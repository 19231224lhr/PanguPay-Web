import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import WalletOrganizationView from '@/views/wallet/WalletOrganizationView.vue'
import { configureWalletEntryService, type WalletEntryService } from '@/wallet/entryService'

describe('WalletOrganizationView', () => {
  const service: WalletEntryService = {
    recover: vi.fn<WalletEntryService['recover']>(),
    listOrganizations: vi.fn<WalletEntryService['listOrganizations']>(async () => [
      { id: '10000000', name: '星河担保组织' },
    ]),
    organization: vi.fn<WalletEntryService['organization']>(async () => ({
      id: '10000000',
      name: '星河担保组织',
      pledgeAmount: '1000',
      guarantorCount: 2,
      certifierCount: 3,
      nodes: [],
      assignAvailable: true,
      aggregationAvailable: true,
    })),
    join: vi.fn<WalletEntryService['join']>(),
    leave: vi.fn<WalletEntryService['leave']>(),
    registerAddress: vi.fn<WalletEntryService['registerAddress']>(),
    unbindAddress: vi.fn<WalletEntryService['unbindAddress']>(),
    registerNoGroup: vi.fn<WalletEntryService['registerNoGroup']>(),
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    configureWalletEntryService(service)
  })

  afterEach(() => configureWalletEntryService(undefined))

  it('uses the same authoritative detail flow as wallet entry', async () => {
    const wrapper = mount(WalletOrganizationView, {
      global: {
        stubs: {
          OrganizationDetailDialog: {
            props: ['open', 'organization', 'detail', 'busy', 'error'],
            template: '<div data-organization-dialog>{{ detail?.pledgeAmount }}</div>',
          },
        },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('星河担保组织')
    await wrapper.get('button[aria-label="查看星河担保组织详情"]').trigger('click')
    await flushPromises()

    expect(service.organization).toHaveBeenCalledWith('10000000', '星河担保组织')
    expect(wrapper.get('[data-organization-dialog]').text()).toContain('1000')
  })

  it('shows authoritative member nodes and requires a second safe-exit confirmation', async () => {
    vi.mocked(service.organization).mockResolvedValueOnce({
      id: '10000000',
      name: '星河担保组织',
      pledgeAmount: '1000',
      guarantorCount: 1,
      certifierCount: 1,
      nodes: [
        { role: 'assign', id: 'assign-1', endpoint: '127.0.0.1:3003', status: 'online' },
        { role: 'guarantor', id: 'guar-1', peerId: 'peer-guar', status: 'active' },
      ],
      assignAvailable: true,
      aggregationAvailable: true,
    })
    const wallet = useWalletStore()
    wallet.unlockedRecord = {
      account_id: '12345678',
      account_private_scalar: '01'.repeat(32),
      addresses: [],
    }
    const dashboard = useDashboardStore()
    dashboard.snapshot = {
      accountId: '12345678',
      displayName: 'Alice',
      addresses: [],
      assets: [],
      organization: { id: '10000000', name: '星河担保组织', role: 'member' },
      security: {
        spendReady: '0',
        credentialStatus: 'normal',
        pendingAudits: 0,
        isolatedCount: 0,
      },
      credentials: [],
      activities: [],
      updatedAt: Date.now(),
      source: 'live',
    }
    dashboard.sync = vi.fn<(manual?: boolean) => Promise<void>>(async () => {
      if (dashboard.snapshot)
        dashboard.snapshot = { ...dashboard.snapshot, organization: undefined }
    })

    const wrapper = mount(WalletOrganizationView)
    await flushPromises()

    expect(wrapper.text()).toContain('assign-1')
    expect(wrapper.text()).toContain('guar-1')
    expect(wrapper.text()).toContain('快速能力已启用')

    const check = wrapper.findAll('button').find((button) => button.text().includes('检查退出条件'))
    expect(check).toBeTruthy()
    await check!.trigger('click')
    expect(wrapper.text()).toContain('再次确认')
    expect(service.leave).not.toHaveBeenCalled()

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text().includes('确认退出组织'))
    await confirm!.trigger('click')
    await flushPromises()
    expect(service.leave).toHaveBeenCalledWith('10000000')
  })
})
