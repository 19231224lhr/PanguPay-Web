import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createWalletNetwork, walletNetworkKey } from '@/composables/useWalletNetwork'
import { useDashboardStore } from '@/stores/dashboard'
import { useWalletStore } from '@/stores/wallet'
import WalletOrganizationView from '@/views/wallet/WalletOrganizationView.vue'
import { configureWalletEntryService, WalletEntryConfirmationPending, type WalletEntryService } from '@/wallet/entryService'

vi.mock('@/components/WalletFigure.vue', () => ({
  default: { template: '<div aria-hidden="true" />' },
}))

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
    const network = createWalletNetwork()
    await network.directory.refresh()
    const wrapper = mount(WalletOrganizationView, {
      global: {
        provide: { [walletNetworkKey as symbol]: network },
      },
    })
    await flushPromises()

    expect(wrapper.text()).toContain('星河担保组织')
    await wrapper.get('button[aria-label="查看星河担保组织详情"]').trigger('click')
    await flushPromises()

    expect(service.organization).toHaveBeenCalledWith('10000000', '星河担保组织')
    expect(wrapper.get('[role="region"]').text()).toContain('1,000 CAL')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.get('input[type="radio"]').element).toHaveProperty('checked', false)
    await wrapper.get('button[aria-expanded="true"]').trigger('click')
    expect(wrapper.find('[role="region"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('can retry failed detail reads and distinguishes registered and missing entry points', async () => {
    vi.mocked(service.organization)
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        id: '10000000',
        name: '星河担保组织',
        nodes: [],
        guarantorCount: 0,
        certifierCount: 0,
        assignAvailable: true,
        assignEndpoint: 'https://assign.test',
        aggregationAvailable: false,
      })
    const network = createWalletNetwork()
    await network.directory.refresh()
    const wrapper = mount(WalletOrganizationView, {
      global: { provide: { [walletNetworkKey as symbol]: network } },
    })
    await wrapper.get('button[aria-expanded]').trigger('click')
    await flushPromises()
    const region = wrapper.get('[role="region"]')
    expect(region.get('[role="alert"]').text()).toContain('暂时无法读取详情')
    expect(region.find('.detail-metrics').exists()).toBe(false)
    await region.get('button').trigger('click')
    await flushPromises()
    const summaries = region.findAll('summary')
    expect(summaries[0]!.text()).toContain('已登记入口')
    expect(summaries[1]!.text()).toContain('未登记入口')
    expect(service.organization).toHaveBeenCalledTimes(2)
    wrapper.unmount()
  })

  it('searches all registered IDs and clears a selection hidden by the filter', async () => {
    vi.mocked(service.listOrganizations).mockResolvedValueOnce([
      { id: '10000000', name: '星河担保组织' },
      { id: 'TEST-2901', name: '第二担保组织' },
    ])
    const network = createWalletNetwork()
    await network.directory.refresh()
    const wrapper = mount(WalletOrganizationView, {
      global: { provide: { [walletNetworkKey as symbol]: network } },
    })

    const search = wrapper.get('input[type="search"]')
    await search.setValue('  t-29  ')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(1)
    const second = wrapper.get('input[value="TEST-2901"]')
    await second.setValue(true)
    const joinButton = wrapper.get('.organization-actions button:last-child')
    expect(joinButton.attributes('disabled')).toBeUndefined()
    await search.setValue('not-registered')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(0)
    expect(wrapper.get('[role="status"]').text()).toContain('没有找到匹配的组织 ID')
    expect(joinButton.attributes('disabled')).toBeDefined()
    await search.setValue('')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
    expect(joinButton.attributes('disabled')).toBeDefined()
    expect(service.organization).not.toHaveBeenCalled()
    expect(service.join).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('checks a pending join without submitting another application', async () => {
    const network = createWalletNetwork()
    await network.directory.refresh()
    const checkMembership = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.mocked(service.join).mockRejectedValueOnce(new WalletEntryConfirmationPending(checkMembership))
    const sync = vi.spyOn(useDashboardStore(), 'sync').mockResolvedValue(undefined)
    const wrapper = mount(WalletOrganizationView, {
      global: { provide: { [walletNetworkKey as symbol]: network } },
    })

    await wrapper.get('input[value="10000000"]').setValue(true)
    const action = wrapper.get('.organization-actions button:last-child')
    await action.trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="status"]').text()).toContain('等待确认加入')
    expect(action.text()).toBe('检查加入状态')

    await action.trigger('click')
    await flushPromises()
    expect(service.join).toHaveBeenCalledExactlyOnceWith('10000000')
    expect(checkMembership).toHaveBeenCalledOnce()
    expect(sync).toHaveBeenCalledExactlyOnceWith(true)
    wrapper.unmount()
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

    const network = createWalletNetwork()
    await network.organization(dashboard.snapshot.organization!).refresh()
    const wrapper = mount(WalletOrganizationView, {
      global: { provide: { [walletNetworkKey as symbol]: network } },
    })
    await flushPromises()

    const roles = wrapper.findAll<HTMLDetailsElement>('.organization-roster__groups > details')
    expect(roles).toHaveLength(4)
    expect(roles.every((role) => !role.element.open)).toBe(true)
    const assign = roles[0]!
    await assign.get('summary').trigger('click')
    expect(assign.element.open).toBe(true)
    expect(assign.text()).toContain('assign-1')
    expect(assign.text()).toContain('127.0.0.1:3003')
    expect(roles[3]!.element.open).toBe(false)
    expect(wrapper.text()).toContain('快速能力已启用')

    expect(service.organization).toHaveBeenCalledTimes(1)
    vi.mocked(service.organization).mockRejectedValueOnce(new Error('Offline'))
    await wrapper.get('.organization-roster button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('上次成功读取的数据')
    expect(assign.text()).toContain('assign-1')
    expect(assign.element.open).toBe(true)

    const check = wrapper.findAll('button').find((button) => button.text().includes('检查退出条件'))
    expect(check).toBeTruthy()
    await check!.trigger('click')
    expect(wrapper.get('.organization-exit [role="status"]').text()).toContain('再次确认')
    expect(wrapper.get('.organization-exit__actions').text()).not.toContain('再次确认')
    expect(service.leave).not.toHaveBeenCalled()

    const confirm = wrapper
      .findAll('button')
      .find((button) => button.text().includes('确认退出组织'))
    const checkExitStatus = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
    vi.mocked(service.leave).mockRejectedValueOnce(new WalletEntryConfirmationPending(checkExitStatus))
    await confirm!.trigger('click')
    await flushPromises()
    expect(service.leave).toHaveBeenCalledWith('10000000')
    expect(wrapper.text()).toContain('暂未收到退出结果')
    expect(document.querySelector('.organization-membership-notice')).toBeNull()
    const retry = wrapper.findAll('button').find((button) => button.text() === '检查退出状态')
    await retry!.trigger('click')
    await flushPromises()
    expect(checkExitStatus).toHaveBeenCalledOnce()
    expect(service.leave).toHaveBeenCalledTimes(1)
    expect(wrapper.find('.organization-exit').exists()).toBe(false)
    expect(document.querySelector('.organization-membership-notice')?.textContent).toContain(
      '退出已确认',
    )
    wrapper.unmount()
  })
})
