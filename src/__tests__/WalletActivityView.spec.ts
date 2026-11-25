vi.mock('@/components/WalletFigure.vue', () => ({ default: { template: '<div />' } }))
import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'

const incomingId = 'b'.repeat(64)
vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({
    current: {
      activities: [{ id: incomingId, title: '转入', status: 'settled', direction: 'in', amount: '1', timestamp: 1 }],
    },
  }),
}))
vi.mock('@/stores/transfer', () => ({
  useTransferStore: () => ({
    synchronizeHistory: vi.fn<(...args: unknown[]) => unknown>(),
    history: [
      {
        draftID: 'test',
        txID: 'a'.repeat(64),
        mode: 'quick',
        phase: 'registered',
        amount: '1',
        recipient: 'recipient',
        coinType: 0,
        acceptedAt: 1789277256321,
        backendAcceptedAt: 1789277256321,
        registeredAt: 1789277256381,
        updatedAt: 1789277256400,
      },
    ],
  }),
}))

it('passes the full journal milestones from activity rows into the shared timeline', () => {
  const wrapper = mount(WalletActivityView, {
    global: {
      stubs: { WalletPageHeader: true, StatusLabel: { template: '<span><slot /></span>' } },
    },
  })
  expect(wrapper.text()).toContain('CAL')
  expect(wrapper.text()).toContain('TXCer 已登记')
  expect(wrapper.text()).toContain('登记确认耗时 60 ms')
  expect(wrapper.text()).toContain('入口接收时间')
  expect(wrapper.text()).not.toContain('收款方可用')
  expect(wrapper.findAll('[data-activity-step]')[0]?.attributes('data-state')).toBe('complete')
})

it('shows a compact incoming record and copies its complete transaction ID', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined)
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
  const wrapper = mount(WalletActivityView, { global: { stubs: { WalletPageHeader: true } } })
  try {
    const incoming = wrapper.findAll('details').find((row) => row.get('summary').text().includes('转入'))!
    expect(incoming.get('summary').text()).toContain('已结算')
    expect(incoming.find('.activity-progress').exists()).toBe(false)
    expect(incoming.get('code').text()).toBe(incomingId)
    await incoming.get('button[aria-label="复制 完整交易 ID"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith(incomingId)
    expect(incoming.text()).toContain('已复制')
  } finally {
    wrapper.unmount()
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard)
    else Reflect.deleteProperty(navigator, 'clipboard')
  }
})
