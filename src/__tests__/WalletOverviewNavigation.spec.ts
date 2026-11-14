import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import WalletOverviewView from '@/views/wallet/WalletOverviewView.vue'
import type { TransferProgress } from '@/transfer'

const mocks = vi.hoisted(() => ({
  transfer: {
    history: [] as TransferProgress[],
    synchronizeHistory: vi.fn<() => Promise<boolean>>(async () => true),
  },
  dashboard: {
    current: {
      displayName: 'Test',
      source: 'gateway',
      assets: [],
      activities: [],
      credentials: [],
      security: { isolatedCount: 0, pendingAudits: 0 },
    },
    sync: vi.fn<(...args: unknown[]) => unknown>(),
    offline: false,
    loading: false,
  },
  wallet: {
    activeAddresses: [
      { address: 'address-one', type: '0' },
      { address: 'address-two', type: '0' },
    ],
    addresses: [{ address: 'address-one' }, { address: 'address-two' }],
    metadata: {
      addresses: {
        'address-one': { registration: 'active' },
        'address-two': { registration: 'active' },
      },
    },
  },
}))
vi.mock('@/stores/dashboard', () => ({ useDashboardStore: () => mocks.dashboard }))
vi.mock('@/stores/wallet', () => ({ useWalletStore: () => mocks.wallet }))
vi.mock('@/stores/transfer', () => ({ useTransferStore: () => mocks.transfer }))
const wrappers: ReturnType<typeof mount>[] = []
async function render() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/wallet', '/wallet/security', '/wallet/activity'].map((path) => ({
      path,
      component: { template: '<div />' },
    })),
  })
  await router.push('/wallet')
  await router.isReady()
  const wrapper = mount(WalletOverviewView, {
    attachTo: document.body,
    global: {
      plugins: [router],
      stubs: {
        WalletFigure: true,
        WalletBalanceField: true,
        WalletNetworkOverview: true,
        WalletPageHeader: { template: '<header><slot /></header>' },
        WalletAddressLedger: {
          template:
            '<section><article tabindex="-1" data-address="address-one">First</article><article tabindex="-1" data-address="address-two">Second</article></section>',
        },
      },
    },
  })
  wrappers.push(wrapper)
  return { wrapper, router }
}
afterEach(() => {
  mocks.transfer.history = []
  wrappers.splice(0).forEach((w) => w.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
describe('Overview navigation', () => {
  it('shows a settled local transfer when the gateway activity feed is empty', async () => {
    mocks.transfer.history = [
      {
        draftID: 'draft-1',
        txID: 'tx-1',
        mode: 'normal',
        phase: 'settled',
        amount: '1',
        recipient: 'test-recipient',
        acceptedAt: 1000,
        updatedAt: 2000,
      },
    ]
    const { wrapper } = await render()
    await flushPromises()
    expect(wrapper.get('.activity .overview-caption').text()).toBe('1 条记录')
    expect(wrapper.get('.activity li').text()).toContain('普通转账')
    expect(wrapper.get('.activity li').text()).toContain('已完成')
    expect(wrapper.find('.activity .overview-empty').exists()).toBe(false)
  })
  it('routes both credential entries and activity details to their pages', async () => {
    const { wrapper, router } = await render()
    await wrapper.get('#overview-security a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/wallet/security')
    await router.push('/wallet')
    await wrapper.get('.security-detail').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/wallet/security')
    await wrapper.get('.activity-detail').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/wallet/activity')
    expect(wrapper.find('.credential-detail').exists()).toBe(false)
    expect(wrapper.find('.receive-qr').exists()).toBe(false)
  })
  it('keeps the ledger visible and focuses the selected address on repeated clicks', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const scroll = vi.fn<(...args: unknown[]) => unknown>()
    const previous = HTMLElement.prototype.scrollIntoView
    HTMLElement.prototype.scrollIntoView = scroll
    try {
      const { wrapper } = await render()
      expect(wrapper.get('#complete-address-ledger').element.tagName).toBe('SECTION')
      expect(wrapper.find('#complete-address-ledger summary').exists()).toBe(false)
      expect(wrapper.get('[data-address="address-two"]').isVisible()).toBe(true)
      const links = wrapper.findAll('.receive-address')
      expect(links).toHaveLength(2)
      await links[1]!.trigger('click')
      await flushPromises()
      expect(document.activeElement?.getAttribute('data-address')).toBe('address-two')
      expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'auto' })
      await links[0]!.trigger('click')
      await flushPromises()
      expect(document.activeElement?.getAttribute('data-address')).toBe('address-one')
    } finally {
      HTMLElement.prototype.scrollIntoView = previous
    }
  })
})
