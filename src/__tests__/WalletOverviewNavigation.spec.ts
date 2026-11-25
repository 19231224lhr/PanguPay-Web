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
      addresses: [{ address: 'address-two', balance: '12', txCerBalance: '3' }],
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
    addresses: [
      { address: 'address-one', type: '0' },
      { address: 'address-two', type: '0' },
    ],
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
        WalletBalanceField: {
          template: `<button data-send-trigger @click="$emit('send')">Send</button>`,
        },
        WalletSendView: {
          template: '<div><slot name="header-action" /><input aria-label="Draft" /></div>',
        },
        WalletNetworkOverview: true,
        WalletPageHeader: { template: '<header><slot /></header>' },
        WalletSecurityView: true,
        WalletActivityView: true,
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
  it('expands Send inside the overview and preserves the draft on collapse and back', async () => {
    const { wrapper, router } = await render()
    await wrapper.get('[data-send-trigger]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet#send')
    expect(wrapper.get('#overview-send').isVisible()).toBe(true)
    expect(wrapper.find('#detail-addresses').exists()).toBe(false)
    await wrapper.get('[aria-label="Draft"]').setValue('draft recipient')
    await wrapper.get('[data-close-send]').trigger('click')
    await flushPromises()
    expect(wrapper.get('#overview-send').isVisible()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[data-send-trigger]').element)
    router.back()
    await flushPromises()
    expect(wrapper.get('#overview-send').isVisible()).toBe(true)
    expect((wrapper.get('[aria-label="Draft"]').element as HTMLInputElement).value).toBe(
      'draft recipient',
    )
  })
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
  it('expands both credential entries and activity details inside the overview', async () => {
    const { wrapper, router } = await render()
    await wrapper.get('#overview-security a').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet#security')
    expect(wrapper.get('#detail-security').isVisible()).toBe(true)
    await router.push('/wallet')
    await wrapper.get('.security-detail').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet#security')
    expect(wrapper.get('#detail-security').isVisible()).toBe(true)
    await wrapper.get('.activity-detail').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet#activity')
    expect(wrapper.get('#detail-activity').isVisible()).toBe(true)
    expect(wrapper.find('.credential-detail').exists()).toBe(false)
    expect(wrapper.find('.receive-qr').exists()).toBe(false)
  })
  it('expands the address card before revealing each address and its actions', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { wrapper, router } = await render()
    const card = wrapper.get('[data-card="addresses-preview"]')
    expect(card.find('details').exists()).toBe(false)
    expect(wrapper.find('#detail-addresses').exists()).toBe(false)

    await card.get('a[href="#addresses"], a[href="/wallet#addresses"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet#addresses')
    expect(card.classes()).toContain('is-expanded')

    const rows = card.get('#detail-addresses').findAll<HTMLDetailsElement>('details')
    expect(rows).toHaveLength(2)
    expect(rows.every(({ element }) => !element.open)).toBe(true)
    await rows[1]!.get('summary').trigger('click')
    expect(rows[1]!.element.open).toBe(true)
    expect(rows[0]!.element.open).toBe(false)
    expect(rows[1]!.get('.ledger-record-details').text()).toContain('15 CAL')
    expect(rows[1]!.findAll('button').map((button) => button.text())).toEqual(['复制', '归档'])
    expect(router.currentRoute.value.fullPath).toBe('/wallet#addresses')

    await card.get('[data-close-panel]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet')
    expect(card.find('#detail-addresses').exists()).toBe(false)
    expect(document.activeElement).toBe(card.get('.address-detail-link').element)
  })

  it('opens the clicked receiving address directly and restores focus when collapsed', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const { wrapper, router } = await render()
    const card = wrapper.get('[data-card="addresses-preview"]')
    const addressButtons = () => card.findAll('li button')

    await addressButtons()[1]!.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/wallet#addresses')
    const rows = card.findAll<HTMLDetailsElement>('.ledger-record')
    expect(rows.map(({ element }) => element.open)).toEqual([false, true])
    expect(rows[1]!.get('.ledger-record-details').text()).toContain('15 CAL')
    expect(document.activeElement).toBe(rows[1]!.get('summary').element)

    await card.get('[data-close-panel]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(addressButtons()[1]!.element)

    await card.get('.address-detail-link').trigger('click')
    await flushPromises()
    expect(card.find('.ledger-record[open]').exists()).toBe(false)
  })
})
