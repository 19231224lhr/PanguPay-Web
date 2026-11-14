vi.mock('@/components/WalletFigure.vue', () => ({ default: { template: '<div />' } }))
import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import WalletActivityView from '@/views/wallet/WalletActivityView.vue'

vi.mock('@/stores/dashboard', () => ({
  useDashboardStore: () => ({ current: { activities: [] } }),
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
  expect(wrapper.text()).toContain('收款方可用时间未回传')
  expect(wrapper.findAll('[data-activity-step]')[0]?.attributes('data-state')).toBe('complete')
})
